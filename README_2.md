Command to send ontology
----
curl.exe -u admin:admin -X POST `
  -H "Content-Type: text/turtle" `
  --data-binary "@ontology.ttl" `
  http://127.0.0.1:3030/history/data
---