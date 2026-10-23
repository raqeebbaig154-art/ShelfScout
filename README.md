# ShelfScout

A cloud hosted book discovery website. Search books by title or author, browse by genre, read details and save favourites.

Cloud Computing semester project, SW 425, MUET SZAB Campus Khairpur Mir's.
Team: Raqeeb Baig K22SW036, Adeel Shad K22SW007, Muhammad Moonam K22SW014.

## What is inside

| Folder or file | What it does |
| --- | --- |
| app/ | The website (HTML, CSS, JavaScript). Pages: Home, Book details, Favourites, Settings, Sign in, About the Team |
| api/ | Azure Functions backend: /api/search, /api/book/{id}, /api/favourites |
| app/staticwebapp.config.json | Azure Static Web Apps settings (Node 20 for the functions) |
| .github/workflows/azure-static-web-apps.yml | GitHub Actions workflow that deploys to Azure on every push to main |

How it works: the browser loads pages from Azure Static Web Apps. Search and book details go through Azure Functions to the Open Library API. Favourites are saved in Azure Table Storage under the signed in user. Sign in uses the built in Static Web Apps login with GitHub or Microsoft.

## Part 1: Run it on your computer (optional, good for testing)

1. Install Node.js 20 from nodejs.org.
2. Install the tools (one time): `npm install -g @azure/static-web-apps-cli azure-functions-core-tools@4 --unsafe-perm true`
3. In the api folder run `npm install`.
4. In the api folder copy `local.settings.json.example` to `local.settings.json`. Leave STORAGE_CONNECTION_STRING empty. Favourites will then be kept in memory only while testing.
5. From the project root run: `swa start app --api-location api`
6. Open http://localhost:4280. The SWA emulator shows a fake login page when you press Sign in.
7. To run the backend tests: in the api folder run `npm test`.

## Part 2: Put the code on GitHub

1. Create a new empty repository on GitHub named ShelfScout.
2. In the project folder run:
   ```
   git init
   git add .
   git commit -m "ShelfScout first version"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/ShelfScout.git
   git push -u origin main
   ```
   The first push will show a failed run in the Actions tab. That is normal, the Azure token is added in Part 4.

## Part 3: Create the Azure resources (Azure portal)

Use one resource group for everything, for example `shelfscout-rg`.

### 3A. Storage account (for favourites)
1. Portal, Create a resource, Storage account.
2. Resource group: shelfscout-rg. Storage account name: something unique in lowercase, for example `shelfscoutstore01`.
3. Region: the one closest to you. Performance: Standard. Redundancy: LRS (cheapest).
4. Review and create, then Create.
5. After it is created, open it, then Security + networking, Access keys, press Show on key1 and copy the whole **Connection string**. Keep it private. Do not put it in GitHub.
   The table named `favourites` is created automatically by the code on first use.

### 3B. Static Web App (the website and the functions)
1. Portal, Create a resource, Static Web App.
2. Resource group: shelfscout-rg. Name: shelfscout. Plan type: Free.
3. Region: pick the nearest region offered.
4. Deployment details, Source: choose **Other** (the workflow file is already in this project, so Azure should not create another one).
5. Review and create, then Create.
6. Open the new Static Web App and press **Manage deployment token**. Copy the token.

## Part 4: Connect GitHub to Azure

1. On GitHub open your repository, Settings, Secrets and variables, Actions, New repository secret.
2. Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`. Value: the deployment token from step 3B.6.
3. Go to the Actions tab, open the failed run and press **Re run all jobs**. Wait for the green tick (about 2 to 3 minutes).
4. In the Azure portal, open the Static Web App and open the URL shown on the Overview page. The website is now live.

## Part 5: Give the backend its storage connection

1. In the Static Web App open **Environment variables**.
2. Add a variable named `STORAGE_CONNECTION_STRING` and paste the connection string from step 3A.5. Save.
3. Wait one minute, then test: sign in with GitHub, press a heart on any book, open Favourites. The book should be listed.
4. To confirm in the cloud: Storage account, Storage browser, Tables, favourites. You should see your saved rows.

## Part 6: Monitoring with Application Insights

1. In the Static Web App open **Application Insights** and turn it on. Create a new workspace if Azure asks, in the same resource group.
2. Open the Application Insights resource and look at Live metrics, Failures and Performance while you use the site. Take screenshots for the report.

## Part 7: Test checklist for the demonstration

- Home page loads books and the genre buttons change the list.
- Search by title or author works, and the sort option changes the order.
- A book opens its details page (cover, rating, pages, publisher, categories, description) and Copy link works.
- Sign in with GitHub works. Heart saves a book, and the book appears on the Favourites page after a refresh.
- Settings theme switch (light and dark) is remembered after reload.
- About the Team page shows the names and roll numbers.
- Push a small change to main and show that GitHub Actions redeploys the site by itself.

## Notes

- The Open Library API is free and has no key. The backend sends a User Agent and caches answers for 5 minutes.
- If a search fails, the website shows a clear message (offline, too slow, or service busy) with a Try again button.
- Never commit `api/local.settings.json` or any connection string. The .gitignore already blocks local.settings.json.
