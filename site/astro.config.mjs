import { defineConfig } from 'astro/config';

// GitHub Pages 用の site / base を自動で決める。
//  - GitHub Actions 上: GITHUB_REPOSITORY (owner/repo) から算出
//      https://<owner>.github.io/<repo>/   (リポジトリ名が <owner>.github.io なら直下)
//  - 独自ドメインを使う場合: 環境変数 SITE (例 https://example.com) と BASE (例 /) を指定
//  - ローカル: SITE/BASE 未指定なら base は '/'
const repoFull = process.env.GITHUB_REPOSITORY || '';
const [owner, repo] = repoFull.split('/');
const isUserSite = repo && repo.toLowerCase() === `${owner.toLowerCase()}.github.io`;

const site = process.env.SITE || (owner ? `https://${owner.toLowerCase()}.github.io` : undefined);
const base = process.env.BASE ?? (repo && !isUserSite ? `/${repo}` : '/');

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
});
