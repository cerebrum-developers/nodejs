secrets = [
  {
    name      = "ML_SEARCH_API_KEY"
    valueFrom = "arn:aws:secretsmanager:us-west-2:633384144996:secret:jwatch/jw-api/sad/system-secrets-x5ulZX:ML_SEARCH_API_KEY::"
  },
  {
    name      = "ML_AUTHOR_API_KEY"
    valueFrom = "arn:aws:secretsmanager:us-west-2:633384144996:secret:jwatch/jw-api/sad/system-secrets-x5ulZX:ML_AUTHOR_API_KEY::"
  },
  {
    name      = "ODL_PASSWORD"
    valueFrom = "arn:aws:secretsmanager:us-west-2:633384144996:secret:jwatch/jw-api/sad/system-secrets-x5ulZX:ODL_PASSWORD::"
  },
  {
    name      = "ML_CONTENT_API_KEY"
    valueFrom = "arn:aws:secretsmanager:us-west-2:633384144996:secret:jwatch/jw-api/sad/system-secrets-x5ulZX:ML_CONTENT_API_KEY::"
  },
  {
    name      = "CLIENT_ID"
    valueFrom = "arn:aws:secretsmanager:us-west-2:633384144996:secret:jwatch/jw-api/sad/system-secrets-x5ulZX:CLIENT_ID::"
  },
  {
    name      = "JW_AUTH_KEY"
    valueFrom = "arn:aws:secretsmanager:us-west-2:633384144996:secret:jwatch/jw-api/sad/system-secrets-x5ulZX:JW_AUTH_KEY::"
  },
  {
    name      = "CONTENT_TRANSFORM_KEY"
    valueFrom = "arn:aws:secretsmanager:us-west-2:633384144996:secret:jwatch/jw-api/sad/system-secrets-x5ulZX:CONTENT_TRANSFORM_KEY::"
  },
  {
    name      = "CONTENTFUL_SPACE"
    valueFrom = "arn:aws:secretsmanager:us-west-2:633384144996:secret:jwatch/jw-api/sad/system-secrets-x5ulZX:CONTENTFUL_SPACE::"
  },
  {
    name      = "CONTENTFUL_TOKEN"
    valueFrom = "arn:aws:secretsmanager:us-west-2:633384144996:secret:jwatch/jw-api/sad/system-secrets-x5ulZX:CONTENTFUL_TOKEN::"
  },
  {
    name      = "X_API_KEY_HEALTHCHECK_LOGIN"
    valueFrom = "arn:aws:secretsmanager:us-west-2:633384144996:secret:jwatch/jw-api/sad/system-secrets-x5ulZX:X_API_KEY_HEALTHCHECK_LOGIN::"
  },
  {
    name      = "HEALTH_CHECK_PASSWORD"
    valueFrom = "arn:aws:secretsmanager:us-west-2:633384144996:secret:jwatch/jw-api/sad/system-secrets-x5ulZX:HEALTH_CHECK_PASSWORD::"
  },
  {
    name      = "JW_WEB_CLIENT_ID"
    valueFrom = "arn:aws:secretsmanager:us-west-2:633384144996:secret:jwatch/jw-api/sad/system-secrets-x5ulZX:JW_WEB_CLIENT_ID::"
  },
  {
    name      = "HEALTH_CHECK_CORRELATION_ID"
    valueFrom = "arn:aws:secretsmanager:us-west-2:633384144996:secret:jwatch/jw-api/sad/system-secrets-x5ulZX:HEALTH_CHECK_CORRELATION_ID::"
  },
  {
    name      = "SPLUNK_TOKEN"
    valueFrom = "arn:aws:secretsmanager:us-west-2:633384144996:secret:jwatch/jw-api/sad/system-secrets-x5ulZX:SPLUNK_TOKEN::"
  },
  {
    name      = "NEW_RELIC_LICENSE_KEY"
    valueFrom = "arn:aws:secretsmanager:us-west-2:633384144996:secret:jwatch/jw-api/sad/system-secrets-x5ulZX:NEW_RELIC_LICENSE_KEY::"
  }
]
jwPdfArchiveS3Bucket = "qa-jw-pdf-archive"