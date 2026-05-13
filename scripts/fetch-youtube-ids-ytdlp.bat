@echo off
chcp 65001 >nul
echo Fetching YouTube Channel IDs using yt-dlp...
echo.

set HANDLES=@ivansbobrovs2751 @cameronmye @JonatheDropped @ИринаПелихова @justus.pianist @Миша_может @antik_ruins @astralionica @p.ivanov @guitarhit @ЖизньвстранеТроллей @ivanzarevich16 @edemdalshe1 @GoodSimpleLiving @truebloodtheband @jonnajinton @ХвойныйКрай @dublincitytoday @garysen-m6s @t-guitar

for %%H in (%HANDLES%) do (
    echo Fetching %%H...
    yt-dlp --print channel_id "https://youtube.com/%%H" 2>nul
    timeout /t 1 /nobreak >nul
)
