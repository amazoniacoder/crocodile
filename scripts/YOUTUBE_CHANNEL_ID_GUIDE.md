# Как получить YouTube Channel ID

YouTube Channel ID нужен для RSS-ленты формата:
```
https://www.youtube.com/feeds/videos.xml?channel_id=UC...
```

## Способ 1: Через исходный код страницы канала

1. Открыть канал в браузере: `https://youtube.com/@handle`
2. Нажать `Ctrl+U` (View Source)
3. Найти `"channelId":"UC..."`
4. Скопировать ID (начинается с `UC`, 24 символа)

## Способ 2: Через расширение браузера

Установить расширение "YouTube Channel ID Finder" для Chrome/Firefox

## Способ 3: Через YouTube Data API

```bash
curl "https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=@handle&key=YOUR_API_KEY"
```

## Способ 4: Автоматический скрипт (Node.js)

Создан скрипт `scripts/fetch-youtube-channel-ids.js` для автоматического получения Channel ID.

---

## Список каналов для добавления

| Handle | Название | Channel ID |
|--------|----------|------------|
| @ivansbobrovs2751 | Ivans Bobrovs 2 | UC190PvMt3RK7VPLOhgltEwg |
| @cameronmye | Cameron | UC9ytq424-N0j3o4u0RDXqTA |
| @JonatheDropped | Jona the Dropped | UC6LrheYTcXbjL_yq4hS1XOQ |
| @ИринаПелихова | Новости грядущего от Ирины Пелиховой | UC0IFwBxAc-9CweT4RGRQyPw |
| @justus.pianist | Justus Eichhorn | UCJkFOASrXyJlvBeI7z4zKoQ |
| @Миша_может | Миша может | UChorJqSaWTlWH_HKnjO2uxw |
| @antik_ruins | Забытые руины | UCTUjcQH88KJODhSm8mc64pg |
| @astralionica | Astralionica | UCfJYTrI7mpPsLJbI5gs1tkw |
| @p.ivanov | Павел Иванов | UC2KPugVH-BPDAwxTDMdMcug |
| @guitarhit | Хиты на гитаре | UCGk9-_Ep1c7mecdmqq3rSng |
| @ЖизньвстранеТроллей | Жизнь в стране Троллей | UCfg5sDQr5HA7Sjpau7YRIlA |
| @ivanzarevich16 | Иван Царевич | UCxQdUTjPbmspOQ_EXuKJ4Ig |
| @edemdalshe1 | Едем Дальше | UCK1-O4RtEtW_zlI_gt62p-w |
| @GoodSimpleLiving | Good Simple Living | UCMOH7My_F61L6VTQHKE3sfA |
| @truebloodtheband | Trueblood | UCeCfPLK_C7eos71GCK5jSvQ |
| @jonnajinton | Jonna Jinton | UCAk3t7WHs2zjsZpopox8Taw |
| @ХвойныйКрай | Хвойный Край | UCWMKez92mSbjoe-n_3P1V2Q |
| @dublincitytoday | Dublin City Today | UCvs4xKpJs2m1nXpf9B5yTkg |
| @garysen-m6s | Guitar B28 | UCdX2eZedHO-CFbcVaaaXP4A |
| @t-guitar | TGuitar | UCdLS3kngddHnUuveFjPGRGg |

---

## После получения Channel ID

1. Обновить скрипт `scripts/add-admin-youtube-channels.sql`
2. Заменить примерные Channel ID на реальные
3. Выполнить скрипт в pgAdmin

Или использовать Zone O в админке для добавления каналов через UI.
