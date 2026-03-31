#!/bin/bash
# Pushes all vars from .env.local to Vercel production environment

ENV_FILE=".env.local"

while IFS= read -r line; do
  # Skip comments and empty lines
  [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue

  KEY="${line%%=*}"
  VALUE="${line#*=}"
  # Strip surrounding quotes
  VALUE="${VALUE#\"}"
  VALUE="${VALUE%\"}"

  echo "Adding $KEY..."
  printf '%s' "$VALUE" | npx vercel env add "$KEY" production --force
done < "$ENV_FILE"

echo "Done! Run: npx vercel --prod"
