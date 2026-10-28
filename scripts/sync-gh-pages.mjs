import fs from 'node:fs'
import path from 'node:path'

const mode = process.argv[2] || 'postbuild'
const rootDir = process.cwd()
const templatePath = path.join(rootDir, 'index.template.html')
const indexPath = path.join(rootDir, 'index.html')
const distDir = path.join(rootDir, 'dist')
const rootAssetsDir = path.join(rootDir, 'assets')

if (mode === 'restore') {
  if (fs.existsSync(templatePath)) {
    fs.copyFileSync(templatePath, indexPath)
  }
  process.exit(0)
}

if (mode === 'postbuild') {
  const distIndex = path.join(distDir, 'index.html')
  const distAssets = path.join(distDir, 'assets')

  if (fs.existsSync(distIndex)) {
    // GitHub Pages (main 브랜치 루트 배포)에서도 즉시 작동하도록 빌드된 index.html과 assets 동기화
    fs.copyFileSync(distIndex, indexPath)
    fs.copyFileSync(distIndex, path.join(rootDir, '404.html'))
    fs.copyFileSync(distIndex, path.join(distDir, '404.html'))
  }

  if (fs.existsSync(distAssets)) {
    if (fs.existsSync(rootAssetsDir)) {
      fs.rmSync(rootAssetsDir, { recursive: true, force: true })
    }
    fs.cpSync(distAssets, rootAssetsDir, { recursive: true })
  }

  // .nojekyll 생성 (GitHub Pages Jekyll 처리 방지)
  fs.writeFileSync(path.join(rootDir, '.nojekyll'), '')
  fs.writeFileSync(path.join(distDir, '.nojekyll'), '')
}

