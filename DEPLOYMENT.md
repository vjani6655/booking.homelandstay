# GitHub Actions Deployment Setup

This repository is configured to automatically deploy to cPanel via FTP when you push to the `main` branch.

## Setup Instructions

### 1. Get Your cPanel FTP Credentials

You'll need the following information from your cPanel:
- **FTP Server**: Usually `ftp.yourdomain.com` or your domain IP
- **FTP Username**: Your cPanel FTP account username
- **FTP Password**: Your cPanel FTP account password
- **Server Directory**: The path on cPanel where files should be deployed (e.g., `/public_html/` or `/public_html/booking/`)

### 2. Add Secrets to GitHub Repository

Go to your GitHub repository: https://github.com/vjani6655/booking.homelandstay

1. Click on **Settings** tab
2. Click on **Secrets and variables** → **Actions** (in left sidebar)
3. Click **New repository secret** and add these four secrets:

   | Secret Name | Value | Example |
   |------------|-------|---------|
   | `FTP_SERVER` | Your FTP server address | `ftp.homelandstay.com` or `123.45.67.89` |
   | `FTP_USERNAME` | Your FTP username | `cpanel_username@homelandstay.com` |
   | `FTP_PASSWORD` | Your FTP password | `your_secure_password` |
   | `FTP_SERVER_DIR` | Target directory on server | `/public_html/` or `/public_html/booking/` |

### 3. How It Works

Once secrets are configured:

1. Make changes to your code locally
2. Commit the changes:
   ```bash
   git add .
   git commit -m "Your commit message"
   ```
3. Push to GitHub:
   ```bash
   git push origin main
   ```
4. GitHub Actions will automatically:
   - Checkout your code
   - Deploy it to your cPanel via FTP
   - You can monitor progress in the **Actions** tab on GitHub

### 4. What Gets Deployed

The following files/folders are deployed:
- ✅ All PHP files (`api/`, `*.php`)
- ✅ Frontend files (`js/`, `css/`, `*.html`)
- ✅ Assets (`assets/`, `uploads/`)
- ✅ Configuration files

The following are excluded from deployment:
- ❌ `.git/` folder
- ❌ Documentation files (`*.md`)
- ❌ Database files (`*.db` - already in .gitignore)
- ❌ IDE files (`.vscode/`, `.idea/`)
- ❌ OS files (`.DS_Store`, `Thumbs.db`)

### 5. First-Time Setup on cPanel

Before deploying, make sure your cPanel has:

1. **PHP 7.4 or higher** enabled
2. **SQLite3** extension enabled
3. **Proper permissions** on the target directory
4. **Database file** uploaded manually (first time only):
   - Upload `api/homeland.db` via cPanel File Manager or FTP
   - Set permissions to `644` or `666` for the database file
   - Set directory permissions to `755`

### 6. Testing the Deployment

After setting up secrets:

1. Make a small change (e.g., add a comment to a file)
2. Commit and push to GitHub
3. Go to the **Actions** tab on GitHub
4. Watch the deployment process
5. Check your live site to verify changes

### 7. Troubleshooting

**If deployment fails:**

1. Check the **Actions** tab on GitHub for error messages
2. Verify all four secrets are set correctly
3. Ensure FTP credentials are valid (test with FileZilla or another FTP client)
4. Check that `FTP_SERVER_DIR` ends with `/` (e.g., `/public_html/`)
5. Verify your cPanel allows FTP connections

**Common issues:**
- **Connection refused**: Check FTP server address and firewall settings
- **Permission denied**: Check FTP username/password
- **Wrong directory**: Verify `FTP_SERVER_DIR` path
- **Files not updating**: Clear browser cache or check if correct directory

### 8. Manual Deployment (Alternative)

If you need to deploy manually:

```bash
# Via FTP client (FileZilla, Cyberduck, etc.)
# Connect to your FTP server and upload files

# Or via command line
ftp ftp.yourdomain.com
# Enter username and password
# cd to target directory
# put files
```

## Security Notes

- ✅ Database file is excluded from Git (in `.gitignore`)
- ✅ FTP credentials are stored as encrypted secrets on GitHub
- ✅ Secrets are never exposed in logs or code
- ⚠️ Make sure to use strong passwords
- ⚠️ Consider using SFTP instead of FTP if available
- ⚠️ Keep your `.env` file out of Git (already in `.gitignore`)

## Need Help?

If you encounter issues:
1. Check GitHub Actions logs for specific errors
2. Verify cPanel FTP settings
3. Test FTP connection with a desktop FTP client first
4. Ensure file permissions are correct on cPanel
