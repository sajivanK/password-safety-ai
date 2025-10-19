from pymongo import ASCENDING
from database import db

def find_dupes():
    pipeline = [
        {"$match": {"domain": {"$exists": True, "$type": "string"}}},
        {"$group": {
            "_id": {"userId": "$userId", "domain": "$domain", "login": "$login"},
            "ids": {"$push": "$_id"},
            "count": {"$sum": 1},
        }},
        {"$match": {"count": {"$gt": 1}}}
    ]
    return list(db.vault_entries.aggregate(pipeline))

def main():
    dupes = find_dupes()
    if dupes:
        print("❗ Found duplicates. Resolve these before creating the unique index:")
        for d in dupes[:25]:
            print(f"- userId={d['_id']['userId']} domain={d['_id']['domain']} login={d['_id']['login']} count={d['count']} ids={d['ids']}")
        print("\nTip: delete/merge those docs, then re-run this script.")
        return

    print("✅ No duplicates detected. Creating unique index...")
    db.vault_entries.create_index(
        [("userId", ASCENDING), ("domain", ASCENDING), ("login", ASCENDING)],
        unique=True,
        name="uniq_user_domain_login",
        partialFilterExpression={"domain": {"$exists": True, "$type": "string"}},
        background=True,
    )
    print("✅ Unique index created: uniq_user_domain_login")

if __name__ == "__main__":
    main()
