Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path dist | Out-Null
Copy-Item -Recurse -Force src/* dist/
Copy-Item -Recurse -Force asset dist/
