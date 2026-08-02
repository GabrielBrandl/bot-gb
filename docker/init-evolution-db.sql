-- Ensure Evolution API has its own database (local Docker / EasyPanel postgres init)
SELECT 'CREATE DATABASE evolution'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'evolution')\gexec
