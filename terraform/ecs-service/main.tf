module "ecs-service" {
  # Add release tag to querystring, e.g "?ref=v0.0.3".
  source = "git@github.com:MassMedicalSociety/cicd-templates.git//terraform/modules/ecs-service?ref=v1.7.1"

  serviceName         = var.serviceName
  region              = var.region
  environment         = var.environment
  gitRepoName         = var.gitRepoName
  dockerImage         = var.dockerImage
  targetAccountNumber = var.targetAccountNumber
  secrets             = var.secrets
}

# Attach policies
resource "aws_iam_role_policy_attachment" "secrets" {
  role       = module.ecs-service.task_role_name
  policy_arn = aws_iam_policy.secrets.arn
}

resource "aws_iam_role_policy_attachment" "dynamodb" {
  role       = module.ecs-service.task_role_name
  policy_arn = aws_iam_policy.dynamodb.arn
}

resource "aws_iam_role_policy_attachment" "s3" {
  role       = module.ecs-service.task_role_name
  policy_arn = aws_iam_policy.s3.arn
}

# Policies
resource "aws_iam_policy" "secrets" {
  name   = "jw-api-secrets"
  policy = data.aws_iam_policy_document.secrets.json
}

resource "aws_iam_policy" "dynamodb" {
  name   = "jw-api-dynamodb"
  policy = data.aws_iam_policy_document.dynamodb.json
}

resource "aws_iam_policy" "s3" {
  name   = "jw-api-s3-bucket"
  policy = data.aws_iam_policy_document.s3.json
}

# Data sources
data "aws_iam_policy_document" "secrets" {
  statement {
    actions = [
      "secretsmanager:GetResourcePolicy",
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
      "secretsmanager:ListSecretVersionIds"
    ]
    resources = ["arn:aws:secretsmanager:${var.region}:${var.targetAccountNumber}:secret:jwatch/jw-api/sad/system-secrets*"]
    effect    = "Allow"
  }
}

data "aws_iam_policy_document" "dynamodb" {
  statement {
    actions   = ["dynamodb:*"]
    resources = ["arn:aws:secretsmanager:${var.region}:${var.targetAccountNumber}:table/jw-alerts-doi"]
    effect    = "Allow"
  }
  statement {
    actions = [
      "dynamodb:BatchGetItem",
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:Scan"
    ]
    resources = ["arn:aws:dynamodb:${var.region}:${var.targetAccountNumber}:table/jw-career-center-code"]
    effect    = "Allow"
  }
}

data "aws_iam_policy_document" "s3" {
  statement {
    actions = ["s3:*"]
    resources = [
      "arn:aws:s3:::${var.jwPdfArchiveS3Bucket}",
      "arn:aws:s3:::${var.jwPdfArchiveS3Bucket}/*"
    ]
    effect = "Allow"
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
