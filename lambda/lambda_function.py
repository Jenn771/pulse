import json
import os
import boto3

def lambda_handler(event, context):
    ses_sender = os.environ.get("SES_SENDER_EMAIL")
    if not ses_sender:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "SES_SENDER_EMAIL environment variable is missing"}),
        }

    if isinstance(event, dict) and "body" in event and event["body"] is not None:
        raw = event["body"]
        data = json.loads(raw) if isinstance(raw, str) else raw
    else:
        data = event

    user_email = data.get("email")
    site_url = data.get("url")
    alert_type = data.get("type", "DOWN")

    if not user_email or not site_url:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Missing required fields: email, url"}),
        }

    subject = f"Pulse Alert: {site_url} is {alert_type}"
    message = (
        f"Your monitored site {site_url} is currently {alert_type}. "
        "Pulse will notify you again when the status changes."
    )

    region = os.environ.get("AWS_REGION") or "us-east-1"
    ses = boto3.client("ses", region_name=region)

    try:
        ses.send_email(
            Source=ses_sender,
            Destination={"ToAddresses": [user_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Text": {"Data": message, "Charset": "UTF-8"}},
            },
        )
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"ok": True, "message": "Alert email sent"}),
        }
    except Exception as e:
        print(f"SES Error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Internal mailer error"}),
        }
