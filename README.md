# Rerunning analysis
```SQL
DELETE FROM statistics;
UPDATE repositories SET last_analyzed_commit = NULL;
```

```bash
node analyzer.js
```