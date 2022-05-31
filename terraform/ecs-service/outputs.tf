# Print outputs
output "site_url" {
  value = "${module.ecs-service.site_url}"
}

output "tags" {
  value = module.ecs-service.tags
}