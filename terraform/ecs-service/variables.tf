variable "serviceName" {
  type = string
}
variable "targetAccountNumber" {
  type = string
}
variable "region" {
  type = string
}
variable "environment" {
  type = string
}
variable "gitRepoName" {
  type = string
}
variable "dockerImage" {
  type = string
}
variable "secrets" {
  type = list(object({
    name         = string
    valueFrom = string
  }))
  default = []
}
variable "jwPdfArchiveS3Bucket" {
  type = string
}