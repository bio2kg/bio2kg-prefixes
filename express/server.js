const express = require('express');
var cors = require('cors');
var compression = require('compression');
var helmet = require('helmet');
const { ApolloServer, gql, makeExecutableSchema } = require('apollo-server-express');
const {
  MultiMatchQuery,
  SearchkitResolvers,
  SearchkitSchema,
  RefinementSelectFacet
} = require('@searchkit/schema')
const { useSofa, OpenAPI } = require('sofa-api');
const swaggerUi = require('swagger-ui-express');
const path = require("path");
// import * as swaggerUi from 'swagger-ui-express';
// import { useSofa, OpenAPI } from 'sofa-api';

const searchkitConfig = {
  host: 'https://elastic.registry.bio2kg.org',
  index: 'prefixes',
  hits: {
    fields: ["preferredPrefix" , "altPrefix" , "providerBaseUri" , "alternativeBaseUri" , 
      "miriam" , "biodbCoreId" , "bioportalOntologyId" , "thedatahub" , "abbreviation" , 
      "title" , "description" , "pubmedId" , "organization" , "type" , "keywords" , 
      "homepage" , "homepageStillAvailable" , "subNamespaceInDataset" , "partOfCollection" , 
      "licenseUrl" , "licenseText" , "rights" , "regex" , "exampleId" , "providerHtmlUrl" , 
      "miriamChecked" , "miriamCuratorNotes" , "miriamCoverage" , "updates", "@type", "@context"],
    highlightedFields: [
      'title',
      {
        field: 'description',
        config: { 
          number_of_fragments: 0,
          pre_tags: ['<b>'], 
          post_tags: ['</b>'] 
        }
      }
    ]
  },
  sortOptions: [
    { id: 'relevance', label: "Relevance", field: [{"_score": "desc"}], defaultOption: true},
  ],
  query: new MultiMatchQuery({
    fields: ['preferredPrefix^5', 'altPrefix^4', 'abbreviation^4', 'title^3', 'organization^2', 'description','keywords']
  }),
  // For a CustomQuery check: https://github.com/bio2kg/bio2kg-registry/blob/265c44806ad45b0d202fdd505a7c9cba8f2a8437/website/pages/api/graphql.tsx#L30
  facets: [
    new RefinementSelectFacet({
      field: 'type.keyword',
      identifier: 'type',
      label: 'Type',
      size: 10,
      multipleSelect: true
    }),
    new RefinementSelectFacet({
      field: 'keywords.keyword',
      identifier: 'keywords',
      label: 'Keywords',
      size: 10
    }),
    new RefinementSelectFacet({
      field: 'organization.keyword',
      identifier: 'organization',
      label: 'Organization',
      size: 10,
      multipleSelect: true
    })
  ]
}

var { typeDefs, withSearchkitResolvers, context } = SearchkitSchema({
  config: searchkitConfig, // searchkit configuration
  typeName: 'ResultSet', // base typename
  hitTypeName: 'ResultHit',
  addToQueryType: true // When true, adds a field called results to Query type
})

typeDefs = [
  gql`
    type Query {
      root: String
      getPrefPrefix(id: String!): String
    }

    type HitFields {
      preferredPrefix: String
      altPrefix: [String]
      providerBaseUri: String
      alternativeBaseUri: [String]
      title: String
      description: String
      type: String
      organization: String
      homepage: String
      providerHtmlUrl: String
      exampleId: String
      keywords: [String]
      regex: String
    }

    type ResultHit implements SKHit {
      id: ID!
      fields: HitFields
      exampleUrl: String
      rdfType: String
      context: String
      highlight: Highlight
    }

    type Highlight {
      title: [String]
      description: [String] 
    }
  `,
  ...typeDefs
]

const resolvers = withSearchkitResolvers({
  ResultHit: {
    highlight: (hit) => {
      //var t = hit.highlight.description.join('')
      return hit.highlight
    },
    exampleUrl: (parent) => {
      if (parent.fields.providerHtmlUrl && parent.fields.exampleId) {
        return parent.fields.providerHtmlUrl.replace('$id', parent.fields.exampleId)
      }
    },
    rdfType: (parent) => {
      if (parent.fields['@type']) {
        return parent.fields['@type']
      }
    },
    context: (parent) => {
      if (parent.fields['@context']) {
        return JSON.stringify(parent.fields['@context'])
      }
    }
  },
  Query: {
    getPrefPrefix(uri) {
      return 'pref prefix for ' + uri;
    }
  }
})

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const server = new ApolloServer({
  schema,
  context: {
    ...context
  },
  playground: true,
  introspection: true,
});

const app = express();
// For production (cf. https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs/deployment)
app.use(compression());
app.use(helmet());
app.use(cors());

// if (process.env.NODE_ENV === 'development') {
//  }

// Add Apollo GraphQL endpoint at /graphql
server.applyMiddleware({ app, path: '/graphql' });

// Add RESTful API endpoint with Sofa at /api
const openApi = OpenAPI({
  schema,
  info: {
    title: 'Bio2KG Registry API',
    version: '3.0.0',
  },
});
app.use(
  useSofa({
      basePath: '/api',
      schema,
      onRoute(info) {
          openApi.addRoute(info, {
            basePath: '/api',
          });
        },
  })
);
// Add OpenAPI docs at /apidocs
openApi.save('./swagger.yml');
app.use('/apidocs', swaggerUi.serve, swaggerUi.setup(openApi.get('./swagger.yml')));

// Serve searchkit-react at /app
app.use(express.static(path.join(__dirname, ".", "public")));
app.use(express.static("public"));
app.get('/app', function(req, res, next) {
  res.setHeader("Content-Security-Policy", "script-src 'self'");
  // res.sendFile(path.join(__dirname, '../public', 'index.html'));
  res.sendFile(path.join(__dirname, ".", "public", "index.html"));
});

app.listen({ port: 4000 }, () =>
  console.log(`🚀 GraphQL ready at http://localhost:4000${server.graphqlPath}
📖 OpenAPI docs ready at http://localhost:4000/apidocs`)
);
