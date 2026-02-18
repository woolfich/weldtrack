#!/usr/bin/env python3
import os
import json
from pathlib import Path

# Путь к проекту = папка, где лежит этот скрипт
PROJECT_PATH = Path(__file__).parent.resolve()
OUTPUT_FILE = PROJECT_PATH / "weldtrack_project_dump.json"

CODE_EXTENSIONS = {
    '.js', '.ts', '.svelte', '.html', '.css', '.scss', '.json', 
    '.md', '.yml', '.yaml', '.toml', '.env', '.sh', '.py'
}

IGNORE_DIRS = {
    'node_modules', '.git', '.svelte-kit', 'build', 'dist', 
    '.vscode', '.idea', '__pycache__', '.venv', 'venv'
}

IGNORE_FILES = {
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 
    '.DS_Store', 'Thumbs.db', 'weldtrack_project_dump.json',
    'dump_project.py'  # Игнорируем сам себя
}

def should_include_file(file_path: Path) -> bool:
    name = file_path.name
    if name in IGNORE_FILES:
        return False
    if name.startswith('.') and name != '.env':
        return False
    return file_path.suffix in CODE_EXTENSIONS or name in {'.env', 'Dockerfile'}

def scan_project(project_path: Path):
    files_data = []
    
    for root, dirs, files in os.walk(project_path):
        root_path = Path(root)
        
        # Фильтруем директории
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith('.')]
        
        for filename in files:
            file_path = root_path / filename
            
            if not should_include_file(file_path):
                continue
            
            try:
                relative_path = file_path.relative_to(project_path)
                content = file_path.read_text(encoding='utf-8', errors='replace')
                
                files_data.append({
                    "path": str(relative_path),
                    "size": len(content),
                    "content": content
                })
                
                print(f"✓ {relative_path}")
                
            except Exception as e:
                print(f"✗ {file_path}: {e}")
    
    return {
        "project_name": project_path.name,
        "root_path": str(project_path),
        "total_files": len(files_data),
        "files": files_data
    }

def main():
    print(f"Сканирую {PROJECT_PATH}...")
    
    project_data = scan_project(PROJECT_PATH)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(project_data, f, ensure_ascii=False, indent=2)
    
    print(f"\nГотово! Сохранено {project_data['total_files']} файлов")
    print(f"Выходной файл: {OUTPUT_FILE}")
    print(f"Размер: {OUTPUT_FILE.stat().st_size / 1024:.1f} KB")

if __name__ == "__main__":
    main()