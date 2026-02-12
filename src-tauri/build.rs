fn main() {
  // Injecter TAURI_UPDATE_TOKEN dans le binaire si disponible au moment du build
  // Cela permet d'avoir le token disponible via option_env!("TAURI_UPDATE_TOKEN") en production
  if let Ok(token) = std::env::var("TAURI_UPDATE_TOKEN") {
    println!("cargo:rustc-env=TAURI_UPDATE_TOKEN={}", token);
  }
  
  tauri_build::build()
}
