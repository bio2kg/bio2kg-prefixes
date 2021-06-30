# Bio2KG prefixes resolver API

An API to resolve prefixes and identifiers for biomedical concepts based on the Life Science Registry.

1. Extract data from the [Life Science Registry spreadsheet on Google docs](https://docs.google.com/spreadsheets/d/1c4DmQqTGS4ZvJU_Oq2MFnLk-3UUND6pWhuMoP8jgZhg/edit#gid=0)
2. Load to ElasticSearch (deployed with the `docker-compose.yml` file)

ElasticSearch API available at https://bio2kg-prefixes.137.120.31.102.nip.io/_search

Search with cURL:

```bash
curl -XGET --header 'Content-Type: application/json' https://bio2kg-prefixes.137.120.31.102.nip.io/prefixes/_search -d '{
      "query" : {
        "match" : { "Preferred Prefix": "bio" }
    }
}'
```

##  Load the Life Science Registry in ElasticSearch

The process to prepare the ElasticSearch index runs as a GitHub Actions workflow, check it in the `.github/workflows` folder.

To run locally:

1. Install dependencies:

```bash
pip install -r etl/requirements.txt
```

2. Define the ElasticSearch password as environment variable, for example with Bash:

```bash
export ELASTIC_PASSWORD=mypassword
```

3. Run the python script:

```bash
python3 etl/lsr_csv_to_elastic.py
```

## Deploy ElasticSearch

Make sure you use the same password in the GitHub Actions secrets and for the docker compose deployment.

1. Add the ElasticSearch password to a `.env` file alongside the `docker-compose.yml`, for example with Bash:

```bash
echo "ELASTIC_PASSWORD=mypassword" > .env
```

2. Prepare the permission for the shared volume to keep ElasticSearch data persistent:

```bash
mkdir -p /data/bio2kg/prefixes/elasticsearch
sudo chmod g+rwx -R /data/bio2kg/prefixes/elasticsearch
sudo chgrp 1000 -R /data/bio2kg/prefixes/elasticsearch
sudo chown 1000 -R /data/bio2kg/prefixes/elasticsearch
```

3. Start the docker-compose:

```bash
docker-compose up -d
```

## Search website

Interesting options:

* https://www.searchkit.co/
  * Demo: https://demo.searchkit.co
  * GraphQL API: https://searchkit.co/docs/quick-start/api-setup
  * Which example best fits out case? https://github.com/searchkit/searchkit/tree/next/examples
  * Deploy Next with Docker: https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile
* https://github.com/betagouv/react-elasticsearch
  * Demo: https://react-elasticsearch.raph.site/
* https://opensource.appbase.io/reactivesearch/

### GraphQL API

Deployed with SearchKit and Apollo on http://localhost:3000/api/graphql

```javascript
{
  results {
    hits {
      items {
        ... on ResultHit {
          id
          fields {
            preferredprefix
            title
            type
            keywords
          }
        }
      }
    }
  }
}
```

