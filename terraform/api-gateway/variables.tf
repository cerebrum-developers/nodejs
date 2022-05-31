variable "environment" {
  type = string
}
variable "region" {
  type = string
}
variable "gitRepoName" {
  type    = string
}
variable "targetAccountNumber" {
  type = string
}

# API Gateway
variable "apiName" {
  type    = string
  default = "Journal Watch API"
}
variable "apiDescription" {
  type = string
  default = "jwatch.org API"
}
variable "pathToSwagger" {
  type    = string
  default = "swagger.yml"
}
variable "apiPath" {
  type = string
  default = "jw-api"
}
variable "domainName" {
  type = string
}
variable "nodeApiDomain" {
  type = string
}
variable "endpointType" {
  type = string
  default = "EDGE"
}

# API stage
variable "clientCertId" {
  type = string
}
variable "stageName" {
  type    = string
  default = "stable"
}
variable "cachClusterEnabled" {
  type = bool
  default = true
}
variable "cacheClusterSize" {
  type = string
  default = "1.6"
}

# API method settings
variable "loggingLevel" {
  type    = string
  default = "ERROR"
}
