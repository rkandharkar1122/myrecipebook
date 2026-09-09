terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.31"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.17"
    }
  }

  # Throwaway environment: state is kept locally. To share this cluster, move
  # state to S3 by uncommenting and running `terraform init -migrate-state`.
  #
  # backend "s3" {
  #   bucket = "my-tf-state-bucket"
  #   key    = "myrecipebook/eks/terraform.tfstate"
  #   region = "us-east-1"
  # }
}
