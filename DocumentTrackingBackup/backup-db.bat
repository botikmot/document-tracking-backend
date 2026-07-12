@echo off

set BACKUP_DIR=F:\Projects\DocumentTrackingBackup\database
set DATE=%date:~-4%-%date:~4,2%-%date:~7,2%

pg_dump -U postgres -d document_tracking -f "%BACKUP_DIR%\document_tracking_%DATE%.sql"

echo Backup completed: %DATE%

pause