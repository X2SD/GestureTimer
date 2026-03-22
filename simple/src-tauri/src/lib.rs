use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::fs;
use std::path::{Path, PathBuf};

fn mime_from_path(path: &Path) -> &'static str {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" | "jfif" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    }
}

#[tauri::command]
fn read_image_data_url(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if !p.is_file() {
        return Err("不是有效文件".into());
    }
    let bytes = fs::read(&p).map_err(|e| e.to_string())?;
    let mime = mime_from_path(&p);
    let b64 = STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
fn list_images_in_folder(folder: String) -> Result<Vec<String>, String> {
    let dir = PathBuf::from(&folder);
    if !dir.is_dir() {
        return Err("不是有效文件夹".into());
    }
    let mut out: Vec<String> = Vec::new();
    for e in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let e = e.map_err(|e| e.to_string())?;
        let path = e.path();
        if !path.is_file() {
            continue;
        }
        if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
            let ext = ext.to_ascii_lowercase();
            if matches!(
                ext.as_str(),
                "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" | "jfif"
            ) {
                out.push(path.to_string_lossy().into_owned());
            }
        }
    }
    out.sort_by(|a, b| {
        let fa = Path::new(a).file_name().map(|s| s.to_string_lossy());
        let fb = Path::new(b).file_name().map(|s| s.to_string_lossy());
        fa.cmp(&fb)
    });
    Ok(out)
}

#[tauri::command]
fn pick_folder() -> Option<String> {
    rfd::FileDialog::new().pick_folder().map(|p| p.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_image_data_url,
            list_images_in_folder,
            pick_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
