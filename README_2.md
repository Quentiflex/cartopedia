Command to send ontology
----
curl.exe -u admin:admin -X POST `
  -H "Content-Type: text/turtle" `
  --data-binary "@ontology.ttl" `
  http://127.0.0.1:3030/history/data
---
Delete everything:
curl.exe -X POST ^
  -H "Content-Type: application/sparql-update" ^
  --data "CLEAR ALL" ^
  http://127.0.0.1:3030/history/update

Delete only graph:
curl.exe -X POST ^
  -H "Content-Type: application/sparql-update" ^
  --data "CLEAR GRAPH <http://cartopedia.org/graph/wikidata/events>" ^
  http://127.0.0.1:3030/history/update

----
 docker run --rm -i `
>>   -v fuseki_data:/fuseki `
>>   -v ${PWD}:/data `
>>   stain/jena-fuseki:latest `
>>   sh -c "bzip2 -dc /data/latest-truthy.nt.bz2 | tdbloader2 --loc /fuseki/databases/history --graph http://cartopedia.org/graph/history/raw -"

----
curl.exe -X POST `
  -H "Content-Type: application/sparql-query" `
  --data "SELECT * WHERE { GRAPH <http://cartopedia.org/graph/history/raw> { ?s ?p ?o } } LIMIT 10" `
  http://127.0.0.1:3030/history/sparql

----
curl.exe -X POST `
>>   -H "Content-Type: application/sparql-query" `
>>   --data "SELECT * WHERE { GRAPH <http://cartopedia.org/graph/history/raw> { ?s ?p ?o } } LIMIT 10" `     
>>   http://127.0.0.1:3030/history/sparql
>>