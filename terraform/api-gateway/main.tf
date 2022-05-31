## Modules
module "api-gateway" {
  source = "git@github.com:MassMedicalSociety/cicd-templates.git//terraform/modules/api-gateway?ref=v1.7.2"

  name               = var.apiName
  description        = var.apiDescription
  pathToSwagger      = var.pathToSwagger
  apiPath            = var.apiPath
  domainName         = var.domainName
  stageName          = var.stageName
  clientCertId       = var.clientCertId
  endpointType       = var.endpointType
  cachClusterEnabled = var.cachClusterEnabled
  cacheClusterSize   = var.cacheClusterSize
  swaggerVars = {
    apiName        = var.apiName
    apiDescription = var.apiDescription
    apiPath        = var.apiPath
    domainName     = var.domainName
    nodeApiDomain  = var.nodeApiDomain
  }

  tags = merge(local.tags, { Name : var.apiName })
}

## Resources
# API method settings
resource "aws_api_gateway_method_settings" "api_method_settings" {
  rest_api_id = module.api-gateway.rest_api_id
  stage_name  = var.stageName
  method_path = "*/*"
  settings {
    logging_level = var.loggingLevel
  }
}

## Local variables
locals {
  tags = {
    Region           = var.region
    Environment      = var.environment
    Application      = "jw-api"
    Owner            = "cmiceli@mms.org"
    Product          = "JWatch"
    ManagementMethod = "Terraform"
    GitRepoName      = var.gitRepoName
  }
}

# Provider
provider "aws" {
  region  = var.region
  version = "~> 2.49"
  assume_role {
    role_arn = "arn:aws:iam::${var.targetAccountNumber}:role/Terraform-CrossAccount-Role-from-SHS"
  }
}

terraform {
  backend "s3" {
    dynamodb_table = "TerraformLockDB"
  }
}
