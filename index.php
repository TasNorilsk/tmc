<?php
require __DIR__ . '/config.php';
?>

<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>Учет ТМЦ Электрика</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#00c8ff">
    <script src="script.js" defer></script>
</head>
<body>
<div class="container py-3">
    <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
        <div class="d-flex align-items-center gap-2">
            <h1 class="h4 m-0">Учет ТМЦ</h1>

            <!-- tiny online/offline indicator -->
            <div class="net-indicator" id="netIndicator" title="Статус сети">
                <span class="net-dot" id="netDot"></span>
                <span class="net-text d-none d-sm-inline" id="netText">online</span>
            </div>
        </div>

        <div class="d-flex align-items-center gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm" id="forceRefresh" title="Обновить данные">
                ⟳
            </button>
            <div class="small text-secondary d-none d-sm-block">локально • без перезагрузок</div>
        </div>
    </div>

    <ul class="nav nav-tabs mb-3" role="tablist">
        <li class="nav-item" role="presentation">
            <a class="nav-link active" href="#" data-tab="items" role="tab">Позиции</a>
        </li>
        <li class="nav-item" role="presentation">
            <a class="nav-link" href="#" data-tab="movements" role="tab">Движения</a>
        </li>
        <li class="nav-item" role="presentation">
            <a class="nav-link" href="#" data-tab="refs" role="tab">Справочники</a>
        </li>
    </ul>

    <!-- ITEMS TAB -->
    <div id="tab-items">
        <form id="addForm" class="row g-2 g-sm-3 mb-2 position-relative">
            <div class="col-12 col-sm-5 position-relative">
                <input type="text" class="form-control" id="name" placeholder="Название" autocomplete="off" required>
                <div class="hint-list d-none" id="hintName"></div>
            </div>

            <div class="col-6 col-sm-2 position-relative">
                <input type="text" class="form-control" id="tth1" placeholder="ТТХ1" autocomplete="off" required>
                <div class="hint-list d-none" id="hintTth1"></div>
            </div>

            <div class="col-6 col-sm-2 position-relative">
                <input type="text" class="form-control" id="tth2" placeholder="ТТХ2" autocomplete="off">
                <div class="hint-list d-none" id="hintTth2"></div>
            </div>

            <div class="col-6 col-sm-1">
                <input
                        type="number"
                        class="form-control"
                        id="qty"
                        placeholder="Кол-во"
                        min="0"
                        value="1"
                        inputmode="numeric"
                        pattern="[0-9]*"
                        required
                >
            </div>

            <div class="col-6 col-sm-2">
                <button type="submit" class="btn btn-primary w-100">Добавить</button>
            </div>
        </form>

        <!-- persistent last operation message -->
        <div class="op-msg d-none" id="opMsg">
            <div class="op-msg-text" id="opMsgText"></div>
            <button type="button" class="op-msg-close" id="opMsgClose" aria-label="Скрыть">✕</button>
        </div>

        <input type="text" class="form-control mb-3 mt-2" id="search" placeholder="Поиск по названию, ТТХ1, ТТХ2">

        <!-- Grouped view by category -->
        <div id="itemsList" class="tmc-list"></div>
    </div>

    <!-- MOVEMENTS TAB -->
    <div id="tab-movements" class="d-none">
        <h2 class="h5 mb-3">Движения ТМЦ</h2>

        <form id="moveForm" class="row g-2 g-sm-3 align-items-end mb-3">
            <div class="col-12 col-sm-5">
                <label class="form-label small text-secondary mb-1">Позиция</label>
                <select class="form-select" id="moveItem" required>
                    <option value="">Выберите позицию</option>
                </select>
            </div>
            <div class="col-6 col-sm-2">
                <label class="form-label small text-secondary mb-1">Кол-во</label>
                <input type="number" class="form-control" id="moveQty" placeholder="Кол-во" required min="1" inputmode="numeric" pattern="[0-9]*">
            </div>
            <div class="col-6 col-sm-2">
                <label class="form-label small text-secondary mb-1">Тип</label>
                <select class="form-select" id="moveType" required>
                    <option value="">Тип</option>
                    <option value="install">Установлено</option>
                    <option value="transfer">Передано</option>
                    <option value="dispose">Утилизировано</option>
                    <option value="return">Возвращено</option>
                </select>
            </div>
            <div class="col-12 col-sm-3">
                <label class="form-label small text-secondary mb-1">Куда / кому / причина</label>
                <input type="text" class="form-control" id="moveDest" placeholder="Напр. Щитовая №2" required>
            </div>
            <div class="col-12">
                <button type="submit" class="btn btn-primary w-100 w-sm-auto">Сохранить</button>
            </div>
        </form>

        <div class="table-responsive">
            <table class="table table-striped align-middle" id="moveTable">
                <thead>
                <tr>
                    <th class="col-move-manu"></th>
                    <th>Позиция</th>
                    <th class="text-end">Кол-во</th>
                    <th>Тип</th>
                    <th>Куда</th>
                    <th>Когда</th>
                </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    </div>

    <!-- REFS TAB -->
    <div id="tab-refs" class="d-none">
        <h2 class="h5 mb-3">Справочники</h2>

        <div class="row g-3">
            <!-- Categories -->
            <div class="col-12 col-lg-6">
                <div class="card shadow-sm">
                    <div class="card-body">
                        <div class="d-flex align-items-center justify-content-between mb-2">
                            <div class="fw-semibold">Категории</div>
                        </div>

                        <form id="catForm" class="d-flex gap-2 mb-3">
                            <input type="text" class="form-control" id="catName" placeholder="Новая категория" required>
                            <button class="btn btn-primary" type="submit">Добавить</button>
                        </form>

                        <div class="table-responsive">
                            <table class="table table-sm align-middle mb-0" id="catTable">
                                <thead>
                                <tr>
                                    <th>Название</th>
                                    <th style="width:140px;">Действия</th>
                                </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>

                        <div class="small text-secondary mt-2">Удаление запрещено, если есть привязанные позиции.</div>
                    </div>
                </div>
            </div>

            <!-- Manufacturers -->
            <div class="col-12 col-lg-6">
                <div class="card shadow-sm">
                    <div class="card-body">
                        <div class="d-flex align-items-center justify-content-between mb-2">
                            <div class="fw-semibold">Производители</div>
                        </div>

                        <form id="manuForm" class="row g-2 mb-3">
                            <div class="col-12 col-sm-7">
                                <input type="text" class="form-control" id="manuName" placeholder="Новый производитель" required>
                            </div>
                            <div class="col-12 col-sm-5">
                                <input type="file" class="form-control" id="manuLogo" accept="image/*">
                            </div>
                            <div class="col-12">
                                <button class="btn btn-primary w-100 w-sm-auto" type="submit">Добавить</button>
                            </div>
                        </form>

                        <div class="table-responsive">
                            <table class="table table-sm align-middle mb-0" id="manuTable">
                                <thead>
                                <tr>
                                    <th style="width:80px;"></th>
                                    <th>Название</th>
                                    <th style="width:220px;">Действия</th>
                                </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>

                        <div class="small text-secondary mt-2">Если лого не задано — используется заглушка noname.png.</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

</div>

<!-- Modal: Category + Manufacturer -->
<div class="modal fade" id="catModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="catModalTitle">Категория и производитель</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Закрыть"></button>
            </div>
            <div class="modal-body">
                <div class="mb-3">
                    <label class="form-label small text-secondary">Категория</label>
                    <select class="form-select" id="catSelect" required>
                        <option value="">Выберите</option>
                        <option value="new">Новая категория…</option>
                    </select>
                    <input type="text" class="form-control mt-2 d-none" id="newCat" placeholder="Название новой категории">
                </div>

                <hr class="my-3">

                <div class="mb-2">
                    <label class="form-label small text-secondary">Производитель</label>
                    <select class="form-select" id="manufSelect2" required>
                        <option value="">Выберите</option>
                        <option value="new">Новый производитель…</option>
                    </select>
                    <input type="text" class="form-control mt-2 d-none" id="newManuf" placeholder="Название нового производителя">
                </div>

                <div class="d-flex align-items-center gap-3 mt-3">
                    <div class="logo-box" aria-hidden="true">
                        <div class="logo-placeholder" id="logoPlaceholder">ЛОГО</div>
                        <img id="logoPreview" alt="" />
                    </div>

                    <div class="flex-grow-1">
                        <input type="file" class="form-control" id="logoFile" accept="image/*">
                        <div class="d-flex gap-2 mt-2">
                            <button type="button" class="btn btn-outline-secondary btn-sm" id="removeLogoBtn">Сбросить на noname</button>
                            <span class="small text-secondary">PNG/JPG/WebP • будет приведено к 100×100</span>
                        </div>
                    </div>
                </div>

                <div class="alert alert-info mt-3 mb-0 small">
                    Для существующего производителя можно заменить лого или сбросить на заглушку.
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                <button type="button" class="btn btn-primary" id="saveModal">Сохранить</button>
            </div>
        </div>
    </div>
</div>

<!-- Loader -->
<div class="loader-wrap d-none" id="loader" aria-hidden="true">
    <div class="spinner-border text-primary" role="status" aria-label="Загрузка"></div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
