# GitLab для Obsidian

Плагин читает GitLab через [Gitbeaker](https://github.com/jdalrymple/gitbeaker) (`@gitbeaker/rest` 43.8.0) и показывает задачи, запросы на слияние, список дел и проекты. Открытые задачи записываются заметками со строкой Tasks (`- [ ]`, `📅`, `🆔`).

Запросы уходят только на адрес GitLab из настроек. Токен хранится локально в данных плагина и не отправляется никуда ещё.

## Что умеет

- Панель **GitLab** со списками задач, merge request, todos и проектов.
- Команды синхронизации в папку хранилища.
- Фильтр по области (`assigned_to_me`, `created_by_me`, `all`), состоянию, проекту и меткам.
- Свой шаблон заметки. Если шаблон начинается с `---`, он заменяет файл целиком. Иначе перед ним добавляется frontmatter.

Плейсхолдеры: `{{title}}`, `{{description}}`, `{{state}}`, `{{web_url}}`, `{{iid}}`, `{{id}}`, `{{labels}}`, `{{assignee}}`, `{{author}}`, `{{milestone}}`, `{{due_date}}`, `{{due}}`, `{{project}}`, `{{updated_at}}`, `{{type}}`, `{{reference}}`, `{{checkbox}}`, `{{iid_suffix}}`.

## Настройка

1. В GitLab создайте personal access token с областью **read_api**.
2. В Obsidian откройте **Settings → Community plugins** и включите **GitLab**.
3. Укажите адрес инстанса и токен.
4. Нажмите **Проверить токен**.

По умолчанию заметки пишутся в папку `GitLab/`.

## Сборка

```bash
npm install
npm test
npm run build
```

`npm run build` собирает `main.js` и копирует `main.js`, `manifest.json` и `styles.css` в `../SpeakeasyVPN/.obsidian/plugins/obsidian-gitlab/`. После сборки перезагрузите Obsidian.

`npm run dev` делает то же копирование при каждой пересборке.
