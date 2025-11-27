Sailo Backend 專案的後台 儲存庫
Sailo Backend 是一套支援旅遊行程規劃平台「Sailo」的後端服務。整個後端系統使用 Node.js 與 Express 建構，資料儲存以 MySQL 為核心。後端負責處理會員註冊與登入、行程管理、景點資料、收藏清單、留言回覆、圖片上傳與地圖定位數據等所有邏輯，並透過 RESTful API 提供給前端串接。在會員驗證方面，系統使用 JWT（JSON Web Token）搭配 bcrypt 進行安全性加密。所有登入後的請求都會經過 Token Middleware 驗證，確保每個操作都是合法使用者進行。

在景點資料部分，後端資料庫儲存旅遊景點的名稱、描述、類別、地區編號、Google 地圖的定位資訊、精準經緯度與平均評分。這些資訊提供前端使用 Leaflet API 顯示地圖位置，也能透過 Google Maps 連結進行導航與查看評論。圖片上傳使用 ImageKit 服務，後端提供上傳端點，使用者能上傳景點相片或行程照片，並由 ImageKit 自動處理壓縮與 CDN 加速，最後將圖片 URL 回傳前端。

行程系統包含行程主表與每日行程子表，後端支援建立行程、編輯行程、刪除行程、複製他人公開行程、加入每日景點、加入備註、設定公開或私人等功能。使用者可以自由規劃多天行程，並在任一天新增欲前往的景點資料。收藏系統則讓使用者能建立自己的收藏清單，新增景點、移除景點，並維護與景點的關聯關係。

留言與回覆系統採用景點留言表與景點回覆表（以及行程留言與回覆，若前端有此功能），後端提供新增留言、回覆留言、取得留言列表等功能，以支援前端社群互動。

整體專案採用 MVC 結構。Routes 負責 API 路由與 Token 保護、Controllers 處理邏輯、Models 對應資料表。專案的主要資料表包含 users、places、trips、trip_days、favorites、place_comments、place_replies 等。每個 API 都使用標準 RESTful 設計，例如 /api/auth/login、/api/places/:id、/api/trips/:tripId/day、/api/favorites 等，讓前端開發者能容易取得資料與管理行程。

在專案部署前，須建立 .env 
設定環境變數，包括資料庫連線、JWT 秘鑰、ImageKit API 金鑰。啟動方式為 npm install 安裝所有依賴，並使用 

npm run dev 啟動後端伺服器。

專案結構如下：config（資料庫與 ImageKit 設定）、controllers、models、middlewares、routes、server.js。

Sailo Backend 承載整個旅遊平台的資料處理核心，負責行程邏輯、使用者資訊、圖片儲存、地圖位置資料與社群留言互動，前後端分離架構讓前端能夠順暢地使用 API 建構出完整的使用者旅遊規劃體驗。
