resource "aws_ecr_repository" "recipebook" {
  name                 = "recipebook"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  # Throwaway env: let `terraform destroy` delete the repo even with images in it.
  force_delete = true
}
