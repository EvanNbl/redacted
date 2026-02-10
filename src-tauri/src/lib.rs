#[cfg(desktop)]
mod updater_cmd {
    use serde::Serialize;
    use tauri::AppHandle;
    use tauri_plugin_updater::UpdaterExt;

    #[derive(Debug, Serialize)]
    pub struct UpdateResult {
        pub available: bool,
        pub version: Option<String>,
        pub body: Option<String>,
        pub error: Option<String>,
        /// True si une mise à jour a été installée (l'app doit redémarrer)
        pub installed: bool,
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
            .invoke_handler(tauri::generate_handler![updater_cmd::check_and_install_update]);
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
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
