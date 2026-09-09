output "region" {
  description = "AWS region the cluster lives in."
  value       = var.region
}

output "cluster_name" {
  description = "EKS cluster name."
  value       = module.eks.cluster_name
}

output "ecr_repository_url" {
  description = "Push the app image here (e.g. <url>:v1)."
  value       = aws_ecr_repository.recipebook.repository_url
}

output "configure_kubectl" {
  description = "Run this to point kubectl at the new cluster."
  value       = "aws eks update-kubeconfig --region ${var.region} --name ${module.eks.cluster_name}"
}

output "alb_controller_role_arn" {
  description = "IRSA role assumed by the AWS Load Balancer Controller."
  value       = module.alb_controller_irsa.iam_role_arn
}
