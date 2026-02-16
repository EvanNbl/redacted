#[cfg(desktop)]
mod updater_cmd {
    use serde::Serialize;
    use tauri::AppHandle;
    use tauri_plugin_updater::UpdaterExt;

    const GITHUB_API_LATEST: &str =
        "https://api.github.com/repos/EvanNbl/redacted/releases/latest";
    
    // Fonction helper pour obtenir le token GitHub
    fn get_github_token() -> Option<String> {
        // 1. Token compilé dans le binaire (si disponible au moment du build)
        option_env!("TAURI_UPDATE_TOKEN")
            .map(String::from)
            // 2. Variable d'environnement au runtime (pour le dev local)
            .or_else(|| std::env::var("TAURI_UPDATE_TOKEN").ok())
            .or_else(|| std::env::var("GITHUB_TOKEN").ok())
    }

    #[derive(Debug, Serialize)]
    pub struct AppVersions {
        pub current: String,
        pub latest: Option<String>,
        /// Notes de la release (body) depuis l’API GitHub
        pub latest_notes: Option<String>,
        pub api_error: Option<String>,
    }

    #[tauri::command]
    pub async fn get_app_versions(app: AppHandle) -> AppVersions {
        let current = app.package_info().version.to_string();
        // Charger .env du projet (racine) pour que TAURI_UPDATE_TOKEN soit dispo en dev
        let _ = dotenvy::dotenv();
        if std::env::var("TAURI_UPDATE_TOKEN").is_err() && std::env::var("GITHUB_TOKEN").is_err() {
            if let Ok(cwd) = std::env::current_dir() {
                let _ = dotenvy::from_path(cwd.join("..").join(".env"));
            }
        }
        let client = match reqwest::Client::builder()
            .user_agent("ProjetParis-Tauri-Updater")
            .build()
        {
            Ok(c) => c,
            Err(e) => return AppVersions {
                current: current.clone(),
                latest: None,
                latest_notes: None,
                api_error: Some(e.to_string()),
            },
        };
        // Token pour dépôt privé (même que pour le téléchargement des mises à jour)
        let token = get_github_token();
        let mut request = client.get(GITHUB_API_LATEST);
        if let Some(t) = &token {
            request = request.header("Authorization", format!("Bearer {}", t));
        }
        let (json, api_error) = match request.send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    (resp.json::<serde_json::Value>().await.ok(), None)
                } else {
                    let status = resp.status();
                    let err_msg = format!("{} {}", status.as_u16(), status.canonical_reason().unwrap_or(""));
                    (None, Some(err_msg))
                }
            }
            Err(e) => (None, Some(e.to_string())),
        };
        let latest = json
            .as_ref()
            .and_then(|j| j.get("tag_name").or_else(|| j.get("name")))
            .and_then(|v| v.as_str())
            .map(|s| {
                // Supprimer les préfixes courants : "app-v", "app-", "v"
                let mut cleaned = s.to_string();
                if cleaned.starts_with("app-v") {
                    cleaned = cleaned.strip_prefix("app-v").unwrap_or(&cleaned).to_string();
                } else if cleaned.starts_with("app-") {
                    cleaned = cleaned.strip_prefix("app-").unwrap_or(&cleaned).to_string();
                } else if cleaned.starts_with('v') {
                    cleaned = cleaned.strip_prefix('v').unwrap_or(&cleaned).to_string();
                }
                cleaned
            });
        let latest_notes = json
            .as_ref()
            .and_then(|j| j.get("body"))
            .and_then(|v| v.as_str())
            .map(String::from);
        AppVersions {
            current,
            latest,
            latest_notes,
            api_error,
        }
    }

    #[derive(Debug, Serialize)]
    pub struct UpdateResult {
        pub available: bool,
        pub version: Option<String>,
        pub body: Option<String>,
        pub error: Option<String>,
        /// True si une mise à jour a été installée (l'app doit redémarrer)
        pub installed: bool,
    }

    #[derive(Debug, Serialize)]
    pub struct UpdateInfo {
        pub available: bool,
        pub version: Option<String>,
        pub body: Option<String>,
        pub error: Option<String>,
    }

    /// Vérifie les mises à jour avec les headers d'authentification configurés côté serveur.
    /// Cette commande configure correctement les headers pour télécharger latest.json depuis un dépôt privé.
    #[tauri::command]
    pub async fn check_update_with_auth(app: AppHandle) -> UpdateInfo {
        // Token injecté à la compilation (CI) ou variables d'environnement au runtime
        let token = option_env!("TAURI_UPDATE_TOKEN")
            .map(String::from)
            .or_else(|| std::env::var("GITHUB_TOKEN").ok())
            .or_else(|| std::env::var("TAURI_UPDATE_TOKEN").ok());

        let mut builder = app.updater_builder();
        if let Some(t) = token {
            builder = match builder.header("Authorization", format!("Bearer {}", t)) {
                Ok(b) => b,
                Err(e) => {
                    return UpdateInfo {
                        available: false,
                        version: None,
                        body: None,
                        error: Some(e.to_string()),
                    };
                }
            };
        }

        let updater = match builder.build() {
            Ok(u) => u,
            Err(e) => {
                return UpdateInfo {
                    available: false,
                    version: None,
                    body: None,
                    error: Some(e.to_string()),
                };
            }
        };

        let update = match updater.check().await {
            Ok(Some(u)) => u,
            Ok(None) => {
                return UpdateInfo {
                    available: false,
                    version: None,
                    body: None,
                    error: None,
                };
            }
            Err(e) => {
                return UpdateInfo {
                    available: false,
                    version: None,
                    body: None,
                    error: Some(e.to_string()),
                };
            }
        };

        UpdateInfo {
            available: true,
            version: Some(update.version.clone()),
            body: update.body.clone(),
            error: None,
        }
    }

    #[tauri::command]
    pub async fn check_and_install_update(app: AppHandle) -> UpdateResult {
        // Token injecté à la compilation (CI) ou variables d'environnement au runtime
        let token = option_env!("TAURI_UPDATE_TOKEN")
            .map(String::from)
            .or_else(|| std::env::var("GITHUB_TOKEN").ok())
            .or_else(|| std::env::var("TAURI_UPDATE_TOKEN").ok());

        let mut builder = app.updater_builder();
        if let Some(t) = token {
            builder = match builder.header("Authorization", format!("Bearer {}", t)) {
                Ok(b) => b,
                Err(e) => {
                    return UpdateResult {
                        available: false,
                        version: None,
                        body: None,
                        error: Some(e.to_string()),
                        installed: false,
                    };
                }
            };
        }

        let updater = match builder.build() {
            Ok(u) => u,
            Err(e) => {
                return UpdateResult {
                    available: false,
                    version: None,
                    body: None,
                    error: Some(e.to_string()),
                    installed: false,
                };
            }
        };

        let update = match updater.check().await {
            Ok(Some(u)) => u,
            Ok(None) => {
                return UpdateResult {
                    available: false,
                    version: None,
                    body: None,
                    error: None,
                    installed: false,
                };
            }
            Err(e) => {
                return UpdateResult {
                    available: false,
                    version: None,
                    body: None,
                    error: Some(e.to_string()),
                    installed: false,
                };
            }
        };

        let version = update.version.clone();
        let body = update.body.clone();

        let install_result = update
            .download_and_install(
                |_chunk_len, _content_len| {},
                || {},
            )
            .await;

        match install_result {
            Ok(()) => UpdateResult {
                available: true,
                version: Some(version),
                body: body,
                error: None,
                installed: true,
            },
            Err(e) => UpdateResult {
                available: true,
                version: Some(version),
                body: body,
                error: Some(format!("Installation échouée: {}", e)),
                installed: false,
            },
        }
    }
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        let open_cmd = if cfg!(target_os = "macos") {
            "open"
        } else {
            "xdg-open"
        };
        Command::new(open_cmd)
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        // Sur Windows, utiliser 'start' avec le protocole directement pour mailto:
        // ou explorer.exe pour les URLs HTTP
        if url.starts_with("mailto:") {
            Command::new("cmd")
                .args(["/C", "start", &url])
                .spawn()
                .map_err(|e| format!("Failed to open mailto: {}", e))?;
        } else {
            Command::new("cmd")
                .args(["/C", "start", "", &url])
                .spawn()
                .map_err(|e| format!("Failed to open URL: {}", e))?;
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        use tauri_plugin_sql::{Migration, MigrationKind};
        let migrations = vec![Migration {
            version: 1,
            description: "sheet_cache",
            sql: "CREATE TABLE IF NOT EXISTS sheet_cache (contact_type TEXT PRIMARY KEY, data_json TEXT NOT NULL, fetched_at INTEGER NOT NULL);",
            kind: MigrationKind::Up,
        }];
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init())
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_fs::init())
            .plugin(
                tauri_plugin_sql::Builder::default()
                    .add_migrations("sqlite:contacts_cache.db", migrations)
                    .build(),
            )
            .invoke_handler(tauri::generate_handler![
            updater_cmd::check_and_install_update,
            updater_cmd::check_update_with_auth,
            updater_cmd::get_app_versions,
            open_url,
        ]);
    }

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            
            // Ouvrir les DevTools en production si la variable d'environnement est activée
            #[cfg(desktop)]
            {
                use tauri::Manager;
                
                // Charger les variables d'environnement depuis .env si disponible
                let _ = dotenvy::dotenv();
                
                // Vérifier si les DevTools doivent être activés via la variable d'environnement
                let enable_devtools = std::env::var("TAURI_ENABLE_DEVTOOLS")
                    .map(|v| v == "true" || v == "1")
                    .unwrap_or(false);
                
                if enable_devtools {
                    let app_handle = app.handle();
                    // Essayer d'obtenir la fenêtre principale (par défaut "main" ou la première fenêtre)
                    if let Some(window) = app_handle.get_webview_window("main") {
                        window.open_devtools();
                    } else if let Some((_, window)) = app_handle.webview_windows().iter().next() {
                        window.open_devtools();
                    }
                }
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
