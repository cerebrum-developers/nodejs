secrets = [
  {
    name      = "ML_SEARCH_API_KEY"
    valueFrom = "arn:aws:secretsmanager:us-east-1:915873767176:secret:jwatch/jw-api/sad/system-secrets-9zr3f3:ML_SEARCH_API_KEY::"
  },
  {
    name      = "ML_AUTHOR_API_KEY"
    valueFrom = "arn:aws:secretsmanager:us-east-1:915873767176:secret:jwatch/jw-api/sad/system-secrets-9zr3f3:ML_AUTHOR_API_KEY::"
  },
  {
    name      = "ML_CONTENT_API_KEY"
    valueFrom = "arn:aws:secretsmanager:us-east-1:915873767176:secret:jwatch/jw-api/sad/system-secrets-9zr3f3:ML_CONTENT_API_KEY::"
  },
  {
    name      = "CLIENT_ID"
    valueFrom = "arn:aws:secretsmanager:us-east-1:915873767176:secret:jwatch/jw-api/sad/system-secrets-9zr3f3:CLIENT_ID::"
  },
  {
    name      = "JW_AUTH_KEY"
    valueFrom = "arn:aws:secretsmanager:us-east-1:915873767176:secret:jwatch/jw-api/sad/system-secrets-9zr3f3:JW_AUTH_KEY::"
  },
  {
    name      = "CONTENT_TRANSFORM_KEY"
    valueFrom = "arn:aws:secretsmanager:us-east-1:915873767176:secret:jwatch/jw-api/sad/system-secrets-9zr3f3:CONTENT_TRANSFORM_KEY::"
  },
  {
    name      = "CONTENTFUL_SPACE"
    valueFrom = "arn:aws:secretsmanager:us-east-1:915873767176:secret:jwatch/jw-api/sad/system-secrets-9zr3f3:CONTENTFUL_SPACE::"
  },
  {
    name      = "CONTENTFUL_TOKEN"
    valueFrom = "arn:aws:secretsmanager:us-east-1:915873767176:secret:jwatch/jw-api/sad/system-secrets-9zr3f3:CONTENTFUL_TOKEN::"
  },
  {
    name      = "X_API_KEY_HEALTHCHECK_LOGIN"
    valueFrom = "arn:aws:secretsmanager:us-east-1:915873767176:secret:jwatch/jw-api/sad/system-secrets-9zr3f3:X_API_KEY_HEALTHCHECK_LOGIN::"
  },
  {
    name      = "HEALTH_CHECK_PASSWORD"
    valueFrom = "arn:aws:secretsmanager:us-east-1:915873767176:secret:jwatch/jw-api/sad/system-secrets-9zr3f3:HEALTH_CHECK_PASSWORD::"
  },
  {
    name      = "JW_WEB_CLIENT_ID"
    valueFrom = "arn:aws:secretsmanager:us-east-1:915873767176:secret:jwatch/jw-api/sad/system-secrets-9zr3f3:JW_WEB_CLIENT_ID::"
  },
  {
    name      = "HEALTH_CHECK_CORRELATION_ID"
    valueFrom = "arn:aws:secretsmanager:us-east-1:915873767176:secret:jwatch/jw-api/sad/system-secrets-9zr3f3:HEALTH_CHECK_CORRELATION_ID::"
  },
  {
    name      = "SPLUNK_TOKEN"
    valueFrom = "arn:aws:secretsmanager:us-east-1:915873767176:secret:jwatch/jw-api/sad/system-secrets-9zr3f3:SPLUNK_TOKEN::"
  },
  {
    name      = "NEW_RELIC_LICENSE_KEY"
    valueFrom = "arn:aws:secretsmanager:us-east-1:915873767176:secret:jwatch/jw-api/sad/system-secrets-9zr3f3:NEW_RELIC_LICENSE_KEY::"
  }
]
jwPdfArchiveS3Bucket = "production-jw-pdf-archive-east"