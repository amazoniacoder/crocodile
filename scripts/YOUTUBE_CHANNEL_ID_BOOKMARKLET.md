# Быстрое получение YouTube Channel ID

## Метод 1: Букмарклет (рекомендуется)

1. Создайте закладку в браузере
2. В поле URL вставьте:

```javascript
javascript:(function(){const m=document.body.innerHTML.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/)||document.body.innerHTML.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/);if(m)prompt('Channel ID:',m[1]);else alert('Not found')})();
```

3. Откройте страницу канала YouTube
4. Нажмите на закладку → скопируйте Channel ID

## Метод 2: DevTools Console

1. Откройте канал YouTube
2. F12 → Console
3. Вставьте:

```javascript
document.body.innerHTML.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/) || 
document.body.innerHTML.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/)
```

4. Скопируйте результат из `[1]`

## Метод 3: View Source

1. Откройте канал → Ctrl+U
2. Ctrl+F → `"channelId"`
3. Скопируйте значение после `"channelId":"UC..."`

## Список каналов для обработки

| Handle | Название | URL |
|--------|----------|-----|
| @ivansbobrovs2751 | Ivans Bobrovs 2 | https://youtube.com/@ivansbobrovs2751 |
| @cameronmye | Cameron | https://youtube.com/@cameronmye |
| @JonatheDropped | Jona the Dropped | https://youtube.com/@JonatheDropped |
| @ИринаПелихова | Новости грядущего от Ирины Пелиховой | https://youtube.com/@ИринаПелихова |
| @justus.pianist | Justus Eichhorn | https://youtube.com/@justus.pianist |
| @Миша_может | Миша может | https://youtube.com/@Миша_может |
| @antik_ruins | @antik_ruins | https://youtube.com/@antik_ruins |
| @astralionica | Astralionica | https://youtube.com/@astralionica |
| @p.ivanov | Павел Иванов | https://youtube.com/@p.ivanov |
| @guitarhit | Хиты на гитаре | https://youtube.com/@guitarhit |
| @ЖизньвстранеТроллей | Жизнь в стране Троллей | https://youtube.com/@ЖизньвстранеТроллей |
| @ivanzarevich16 | Иван Царевич | https://youtube.com/@ivanzarevich16 |
| @edemdalshe1 | Едем Дальше | https://youtube.com/@edemdalshe1 |
| @GoodSimpleLiving | Good Simple Living | https://youtube.com/@GoodSimpleLiving |
| @truebloodtheband | Trueblood | https://youtube.com/@truebloodtheband |
| @jonnajinton | Jonna Jinton | https://youtube.com/@jonnajinton |
| @ХвойныйКрай | Хвойный Край | https://youtube.com/@ХвойныйКрай |
| @dublincitytoday | Dublin City Today | https://youtube.com/@dublincitytoday |
| @garysen-m6s | Guitar B28 | https://youtube.com/@garysen-m6s |
| @t-guitar | TGuitar | https://youtube.com/@t-guitar |

## После получения Channel ID

Заполните таблицу в `YOUTUBE_CHANNEL_ID_GUIDE.md` и выполните SQL-скрипт через pgAdmin.
