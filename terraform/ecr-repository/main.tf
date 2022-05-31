module "ecr" {
  # Add release tag to querystring, e.g "?ref=v0.0.3".
  source = "git@github.com:MassMedicalSociety/cicd-templates.git//terraform/modules/ecr-repository?ref=v1.7.1"

  serviceName         = var.serviceName
  region              = var.region
  environment         = var.environment
  gitRepoName         = var.gitRepoName
}

provider "aws" {
  region  = var.region
  version = "~> 2.49"
  assume_role {
    role_arn     = "arn:aws:iam::${var.targetAccountNumber}:role/Terraform-CrossAccount-Role-from-SHS"
  }
}

terraform {
  backend "s3" {
    dynamodb_table = "TerraformLockDB"
  }
}