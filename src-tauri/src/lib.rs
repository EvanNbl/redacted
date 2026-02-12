#[cfg(desktop)]
mod updater_cmd {
    use serde::Serialize;
    use tauri::AppHandle;
    use tauri_plugin_updater::UpdaterExt;

    const GITHUB_API_LATEST: &str =
        "https://api.github.com/repos/EvanNbl/redacted/releases/latest";
    
    // Fonction helper pour obtenir le token GitHub
    fn get_github_token() -> Option<String> {
        // 1. Token compilé dans le binaire via build.rs (si disponible au moment du build)
        // Cela fonctionne en production car le token est injecté dans le binaire lors de la compilation
        let token = option_env!("TAURI_UPDATE_TOKEN")
            .map(String::from)
            // 2. Variable d'environnement au runtime (pour le dev local)
            .or_else(|| std::env::var("TAURI_UPDATE_TOKEN").ok())
            .or_else(|| std::env::var("GITHUB_TOKEN").ok());
        
        if token.is_some() {
            log::info!("[GitHub API] Token trouvé (source: compilé ou env)");
        } else {
            log::warn!("[GitHub API] Aucun token trouvé - option_env!={:?}, TAURI_UPDATE_TOKEN={:?}, GITHUB_TOKEN={:?}", 
                option_env!("TAURI_UPDATE_TOKEN").is_some(),
                std::env::var("TAURI_UPDATE_TOKEN").is_ok(),
                std::env::var("GITHUB_TOKEN").is_ok());
        }
        
        token
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
        log::info!("[GitHub API] Début de get_app_versions");
        let current = app.package_info().version.to_string();
        log::info!("[GitHub API] Version actuelle: {}", current);
        
        // Charger .env du projet (racine) pour que TAURI_UPDATE_TOKEN soit dispo en dev
        let _ = dotenvy::dotenv();
        if std::env::var("TAURI_UPDATE_TOKEN").is_err() && std::env::var("GITHUB_TOKEN").is_err() {
            if let Ok(cwd) = std::env::current_dir() {
                let env_path = cwd.join("..").join(".env");
                log::info!("[GitHub API] Tentative de chargement .env depuis: {:?}", env_path);
                let _ = dotenvy::from_path(env_path);
            }
        }
        
        let client = match reqwest::Client::builder()
            .user_agent("ProjetParis-Tauri-Updater")
            .build()
        {
            Ok(c) => {
                log::info!("[GitHub API] Client HTTP créé avec succès");
                c
            },
            Err(e) => {
                log::error!("[GitHub API] Erreur création client HTTP: {}", e);
                return AppVersions {
                    current: current.clone(),
                    latest: None,
                    latest_notes: None,
                    api_error: Some(e.to_string()),
                };
            },
        };
        
        // Token pour dépôt privé (même que pour le téléchargement des mises à jour)
        let token = get_github_token();
        log::info!("[GitHub API] URL de l'API: {}", GITHUB_API_LATEST);
        log::info!("[GitHub API] Token présent: {}", token.is_some());
        if let Some(t) = &token {
            log::info!("[GitHub API] Token length: {} caractères", t.len());
            log::info!("[GitHub API] Token prefix: {}...", &t[..t.len().min(10)]);
        }
        
        let mut request = client.get(GITHUB_API_LATEST);
        if let Some(t) = &token {
            request = request.header("Authorization", format!("Bearer {}", t));
            log::info!("[GitHub API] Header Authorization ajouté");
        } else {
            log::warn!("[GitHub API] Aucun header Authorization - requête non authentifiée");
        }
        
        log::info!("[GitHub API] Envoi de la requête...");
        let (json, api_error) = match request.send().await {
            Ok(resp) => {
                let status = resp.status();
                log::info!("[GitHub API] Réponse reçue - Status: {} {}", status.as_u16(), status.canonical_reason().unwrap_or(""));
                
                if resp.status().is_success() {
                    log::info!("[GitHub API] Requête réussie, parsing JSON...");
                    match resp.json::<serde_json::Value>().await {
                        Ok(json_val) => {
                            log::info!("[GitHub API] JSON parsé avec succès");
                            (Some(json_val), None)
                        },
                        Err(e) => {
                            log::error!("[GitHub API] Erreur parsing JSON: {}", e);
                            (None, Some(format!("Erreur parsing JSON: {}", e)))
                        }
                    }
                } else {
                    // Essayer de lire le corps de la réponse pour plus de détails
                    let error_body = resp.text().await.unwrap_or_else(|_| "Impossible de lire le corps".to_string());
                    log::error!("[GitHub API] Erreur HTTP {} - Body: {}", status.as_u16(), error_body);
                    let err_msg = format!("{} {} - {}", status.as_u16(), status.canonical_reason().unwrap_or(""), error_body);
                    (None, Some(err_msg))
                }
            }
            Err(e) => {
                log::error!("[GitHub API] Erreur réseau: {}", e);
                (None, Some(e.to_string())),
            },
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init())
            .invoke_handler(tauri::generate_handler![
            updater_cmd::check_and_install_update,
            updater_cmd::check_update_with_auth,
            updater_cmd::get_app_versions,
        ]);
    }

    builder
        .setup(|app| {
            // Activer le logger même en production pour le débogage
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;
            
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
