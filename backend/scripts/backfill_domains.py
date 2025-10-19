# backend/scripts/backfill_domains.py
from datetime import datetime, timezone
from database import db
from utils.domain import normalize_domain
from pymongo import UpdateOne

def main():
    ops = []

    for doc in db.vault_entries.find({}):
        changed = False
        set_fields = {}

        # 1) lowercase login
        login = doc.get("login")
        if isinstance(login, str):
            lu = login.strip().lower()
            if lu != login:
                set_fields["login"] = lu
                changed = True

        # 2) add domain from url if missing
        url = doc.get("url")
        has_domain = bool(doc.get("domain"))
        if (not has_domain) and url:
            d = normalize_domain(url)
            if d:
                set_fields["domain"] = d
                changed = True

        if changed:
            set_fields["updatedAt"] = datetime.now(timezone.utc)
            ops.append(
                UpdateOne({"_id": doc["_id"]}, {"$set": set_fields})
            )

    if ops:
        res = db.vault_entries.bulk_write(ops, ordered=False)
        print(f"Updated {res.modified_count} documents.")
    else:
        print("No changes necessary.")

if __name__ == "__main__":
    main()
