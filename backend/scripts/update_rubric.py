import os
from dotenv import load_dotenv
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

# Load environment variables from backend/.env
load_dotenv()

def main():
    # 1. Verify credentials
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path or not os.path.exists(cred_path):
        raise FileNotFoundError(
            f"Credentials file not found at: {cred_path}\n"
            "Please update GOOGLE_APPLICATION_CREDENTIALS in backend/.env with the exact path."
        )

    # 2. Get exact project and database from .env
    project_id = os.getenv("GCP_PROJECT_ID", "loyal-surfer-457603-j3")
    database_id = os.getenv("FIRESTORE_DATABASE", "promptforge")

    # 3. Initialize Firestore directly (natively supports named databases)
    # It will automatically use the GOOGLE_APPLICATION_CREDENTIALS env var
    db = firestore.Client(project=project_id, database=database_id)
    rubrics_ref = db.collection('rubrics')
    
    # 4. Delete the old rubric(s) using the new FieldFilter syntax
    old_rubrics = rubrics_ref.where(filter=FieldFilter('name', '==', 'TF Single Service Rubric')).stream()
    deleted_count = 0
    for doc in old_rubrics:
        doc.reference.delete()
        deleted_count += 1
    print(f"Deleted {deleted_count} old 'TF Single Service Rubric' document(s).")

    # 5. Create the new v2 rubric
    new_rubric_data = {
        "name": "TF Single Service Rubric v2",
        "description": "Evaluates GCP Terraform module generation for single services",
        "criteria": [
            {
                "name": "correct_module",
                "label": "Correct Module Used",
                "weight": 0.35,
                "description": "Must use terraform-google-modules instead of raw resources."
            },
            {
                "name": "no_hardcoded_values",
                "label": "No Hardcoded Values",
                "weight": 0.25,
                "description": "Must use var.xxx for all values (project IDs, CIDRs, names, etc.)."
            },
            {
                "name": "hcl_validity",
                "label": "HCL Validity",
                "weight": 0.15,
                "description": "Output must be valid HCL without markdown fences or outside comments."
            },
            {
                "name": "data_completeness",
                "label": "Data Completeness",
                "weight": 0.15,
                "description": "Must include all requested subnets and configurations."
            },
            {
                "name": "version_pinned",
                "label": "Version Pinned",
                "weight": 0.10,
                "description": "Must pin version with ~> on the latest major version."
            }
        ]
    }
    
    _, doc_ref = rubrics_ref.add(new_rubric_data)
    print(f"Successfully created 'TF Single Service Rubric v2' with ID: {doc_ref.id}")

if __name__ == "__main__":
    main()