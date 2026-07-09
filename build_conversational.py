#!/usr/bin/env python3
"""Собирает разговорные сценарии и добавляет практичные фразы."""

import json
from pathlib import Path

ROOT = Path(__file__).parent

NEW_PHRASES = [
    {"turkish": "anlamıyorum", "russian": "я не понимаю", "context": "Когда не поняли собеседника"},
    {"turkish": "bilmiyorum", "russian": "я не знаю", "context": "Честный ответ на вопрос"},
    {"turkish": "tekrar söyler misiniz?", "russian": "повторите, пожалуйста?", "context": "Попросить повторить"},
    {"turkish": "yavaş konuşur musunuz?", "russian": "говорите медленнее?", "context": "Попросить говорить медленнее"},
    {"turkish": "İngilizce biliyor musunuz?", "russian": "вы говорите по-английски?", "context": "Спросить о языке"},
    {"turkish": "nasıl gidebilirim?", "russian": "как мне пройти?", "context": "Спросить дорогу"},
    {"turkish": "buradan nasıl gidebilirim?", "russian": "как пройти отсюда?", "context": "Уточнить маршрут"},
    {"turkish": "bu ne kadar?", "russian": "сколько это стоит?", "context": "В магазине или на рынке"},
    {"turkish": "kaç para?", "russian": "сколько стоит?", "context": "Разговорная цена"},
    {"turkish": "hesap lütfen", "russian": "счёт, пожалуйста", "context": "В кафе или ресторане"},
    {"turkish": "burada durun", "russian": "остановитесь здесь", "context": "В такси или автобусе"},
    {"turkish": "kayboldum", "russian": "я заблудился", "context": "Попросить помощь с дорогой"},
    {"turkish": "yardım eder misiniz?", "russian": "поможете?", "context": "Обратиться к прохожему"},
    {"turkish": "tuvalet nerede?", "russian": "где туалет?", "context": "Частый практичный вопрос"},
    {"turkish": "polis nerede?", "russian": "где полиция?", "context": "В сложной ситуации"},
    {"turkish": "emin değilim", "russian": "не уверен", "context": "Мягкий ответ"},
    {"turkish": "olur mu?", "russian": "можно?", "context": "Спросить разрешение"},
    {"turkish": "sorun değil", "russian": "не проблема", "context": "Успокоить или согласиться"},
    {"turkish": "bir dakika", "russian": "минутку", "context": "Попросить подождать"},
    {"turkish": "bekleyin lütfen", "russian": "подождите, пожалуйста", "context": "В очереди или магазине"},
    {"turkish": "bir ... istiyorum", "russian": "я хочу ...", "context": "Заказать еду или напиток"},
    {"turkish": "ne kadar?", "russian": "сколько?", "context": "Уточнить цену или количество"},
    {"turkish": "buyurun", "russian": "пожалуйста / на, держите", "context": "Часто говорят продавцы"},
    {"turkish": "afiyet olsun", "russian": "приятного аппетита", "context": "После еды или в кафе"},
    {"turkish": "görüşmek üzere", "russian": "до встречи", "context": "Прощание"},
]

SCENARIOS = [
    {
        "id": "street-basics",
        "title": "На улице: первые слова",
        "subtitle": "Поздороваться, поблагодарить, сказать «да» и «нет»",
        "pick": lambda w: w["category"] == "Приветствия" and w["id"] <= 35,
    },
    {
        "id": "talk-people",
        "title": "Разговор с людьми",
        "subtitle": "Как дела, знакомство, вежливые фразы",
        "pick": lambda w: w["category"] in ("Люди", "Эмоции")
        or w["id"] in {18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 180, 228, 252}
        or w["turkish"] in ("buyurun", "afiyet olsun", "görüşmek üzere"),
    },
    {
        "id": "ask-understand",
        "title": "Спрашиваю и понимаю",
        "subtitle": "Что, где, куда, когда, сколько",
        "pick": lambda w: w["category"] in ("Вопросы", "Местоимения")
        or w["turkish"] in ("anlamıyorum", "bilmiyorum", "anladım", "anlamak", "bilmek", "tekrar söyler misiniz?", "yavaş konuşur musunuz?", "İngilizce biliyor musunuz?", "emin değilim"),
    },
    {
        "id": "directions",
        "title": "Куда идти",
        "subtitle": "Дорога, улица, направления, как пройти",
        "pick": lambda w: w["category"] in ("Направления", "Город")
        or w["turkish"] in ("gitmek", "gelmek", "dönmek", "durmak", "yol", "nasıl gidebilirim?", "buradan nasıl gidebilirim?", "kayboldum", "kaybolmak", "yardım eder misiniz?", "yardım etmek"),
    },
    {
        "id": "transport",
        "title": "Транспорт и такси",
        "subtitle": "Автобус, метро, такси, остановки",
        "pick": lambda w: w["category"] == "Транспорт" or w["turkish"] in ("burada durun", "durak", "istasyon", "bilet"),
    },
    {
        "id": "shopping",
        "title": "В магазине",
        "subtitle": "Цены, деньги, покупки, числа",
        "pick": lambda w: w["category"] in ("Покупки", "Числа")
        or w["turkish"] in ("bu ne kadar?", "kaç para?", "ne kadar?", "bir ... istiyorum", "buyurun"),
    },
    {
        "id": "cafe",
        "title": "Кафе и еда",
        "subtitle": "Заказать, поесть, счёт",
        "pick": lambda w: w["category"] == "Еда" and w["id"] <= 320,
    },
    {
        "id": "time-answers",
        "title": "Понимаю ответы",
        "subtitle": "Сегодня, завтра, сейчас — что говорят люди",
        "pick": lambda w: w["category"] == "Время"
        or w["turkish"] in ("tamam", "peki", "tabii", "belki", "olur mu?", "sorun değil", "bir dakika", "bekleyin lütfen", "evet", "hayır"),
    },
    {
        "id": "help",
        "title": "Нужна помощь",
        "subtitle": "Здоровье, полиция, срочно",
        "pick": lambda w: w["category"] == "Здоровье"
        or w["turkish"] in ("tuvalet nerede?", "polis nerede?", "tuvalet", "polis", "acil", "yardım eder misiniz?"),
    },
    {
        "id": "travel",
        "title": "В путешествии",
        "subtitle": "Отель, билеты, турист",
        "pick": lambda w: w["category"] == "Путешествия" and w["id"] <= 494,
    },
]


def main():
    with open(ROOT / "words.json", encoding="utf-8") as f:
        words = json.load(f)

    next_id = max(w["id"] for w in words) + 1
    existing = {w["turkish"].lower() for w in words}

    for phrase in NEW_PHRASES:
        key = phrase["turkish"].lower()
        if key in existing:
            for w in words:
                if w["turkish"].lower() == key:
                    w["context"] = phrase.get("context", "")
                    w["practical"] = True
            continue
        words.append({
            "id": next_id,
            "turkish": phrase["turkish"],
            "russian": phrase["russian"],
            "category": "Разговор",
            "context": phrase.get("context", ""),
            "practical": True,
        })
        existing.add(key)
        next_id += 1

    by_id = {w["id"]: w for w in words}
    practical_ids = set()

    scenarios_out = []
    for i, sc in enumerate(SCENARIOS, 1):
        ids = []
        for w in words:
            if sc["pick"](w):
                ids.append(w["id"])
                practical_ids.add(w["id"])
        # сохраняем порядок: сначала короткие фразы, потом по id
        ids = sorted(set(ids), key=lambda x: (len(by_id[x]["turkish"]), x))
        scenarios_out.append({
            "id": sc["id"],
            "title": sc["title"],
            "subtitle": sc["subtitle"],
            "order": i,
            "wordIds": ids,
        })

    for w in words:
        if w["id"] in practical_ids or w.get("practical"):
            w["practical"] = True

    with open(ROOT / "words.json", "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=2)
        f.write("\n")

    with open(ROOT / "scenarios.json", "w", encoding="utf-8") as f:
        json.dump(scenarios_out, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Words: {len(words)}, practical: {len(practical_ids)}, scenarios: {len(scenarios_out)}")


if __name__ == "__main__":
    main()
