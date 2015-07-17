# Integration into N2O
To make use of the already existent N2O application prototype, it is necessary to adapt the database schema of posts to contain candidates. Crawlers that gathered account-related data from job sites and forums would need to be created. The datasets from the different social networks would then need to be linked to give a complete picture to the HR manager.
The working principle of inboxing and forwarding posts can stay, it will also work with employees. Specific employees may be forwarded to HR people of other divisions. In short:

 - Adapt database schema from posts to candidates
 - Create social network crawlers
 - Link data from different social networks


# Rerunning analysis
```SQL
DELETE FROM statistics;
UPDATE repositories SET last_analyzed_commit = NULL;
```

```bash
node analyzer.js
```
