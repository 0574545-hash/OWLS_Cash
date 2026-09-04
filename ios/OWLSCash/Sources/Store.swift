//  Store.swift
//  Данные и расчёты. Схема совпадает с веб-версией, поэтому файл копии
//  «OWLS Cash.json» читается и там, и здесь.

import Foundation
import SwiftUI

// MARK: - Модель

struct Category: Identifiable, Codable, Hashable {
    var id: String
    var name: String
    /// Имя символа SF Symbols.
    var icon: String
    var order: Int
    var hidden: Bool
}

struct Expense: Identifiable, Codable, Hashable {
    var id: String
    /// Локальные дата и время, «2026-09-04T12:40:00». Без часового пояса, как в вебе.
    var ts: String
    var amount: Int
    var catId: String
    var name: String
}

struct AppData: Codable {
    var categories: [Category]
    var expenses: [Expense]
    var backupAt: String = ""
    var edits: Int = 0
    var backupSnooze: String = ""

    static let defaults: [(String, String)] = [
        ("Продукты", "bag"), ("Кафе и рестораны", "cup.and.saucer"), ("Транспорт", "bus"),
        ("Дом и ЖКХ", "house"), ("Здоровье", "heart"), ("Одежда", "tshirt"),
        ("Развлечения", "film"), ("Прочее", "ellipsis")
    ]

    static func seed() -> AppData {
        AppData(
            categories: defaults.enumerated().map { i, c in
                Category(id: "c\(i + 1)", name: c.0, icon: c.1, order: i, hidden: false)
            },
            expenses: []
        )
    }
}

/// Обёртка файла копии: та же, что пишет веб-версия.
struct BackupFile: Codable {
    struct Payload: Codable {
        var categories: [Category]
        var expenses: [Expense]
    }
    var app: String
    var version: Int
    var savedAt: String
    var data: Payload
}

// MARK: - Форматирование

enum Fmt {
    /// Целые рубли, разделитель тысяч неразрывным пробелом.
    static func money(_ n: Int) -> String {
        let s = String(abs(n))
        var out = ""
        for (i, ch) in s.reversed().enumerated() {
            if i > 0 && i % 3 == 0 { out.append("\u{00a0}") }
            out.append(ch)
        }
        return (n < 0 ? "-" : "") + String(out.reversed())
    }

    /// Склонение по числу: 1 операция, 2 операции, 5 операций.
    static func plural(_ n: Int, _ one: String, _ few: String, _ many: String) -> String {
        let m = n % 100, k = n % 10
        if m > 10 && m < 20 { return many }
        if k == 1 { return one }
        if k > 1 && k < 5 { return few }
        return many
    }

    static let dayKeyFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ru_RU")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static let stampFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ru_RU")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return f
    }()

    static func dayKey(_ d: Date) -> String { dayKeyFormatter.string(from: d) }
    static func stamp(_ d: Date) -> String { stampFormatter.string(from: d) }

    static func date(_ d: Date, _ format: String) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ru_RU")
        f.setLocalizedDateFormatFromTemplate(format)
        return f.string(from: d)
    }

    /// «пятница, 4 сентября»
    static func headerDate(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ru_RU")
        f.dateFormat = "EEEE, d MMMM"
        return f.string(from: d)
    }

    /// «сентябрь»
    static func monthName(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ru_RU")
        f.dateFormat = "LLLL"
        return f.string(from: d)
    }

    static func capitalized(_ s: String) -> String {
        guard let first = s.first else { return s }
        return String(first).uppercased() + s.dropFirst()
    }

    /// «Сегодня», «Вчера» или «2 сентября».
    static func dayLabel(_ key: String) -> String {
        let now = Date()
        if key == dayKey(now) { return "Сегодня" }
        if key == dayKey(Calendar.current.date(byAdding: .day, value: -1, to: now)!) { return "Вчера" }
        guard let d = dayKeyFormatter.date(from: key) else { return key }
        let f = DateFormatter()
        f.locale = Locale(identifier: "ru_RU")
        f.dateFormat = Calendar.current.component(.year, from: d) == Calendar.current.component(.year, from: now)
            ? "d MMMM" : "d MMMM yyyy"
        return f.string(from: d)
    }
}

// MARK: - Производные значения

struct DayGroup: Identifiable {
    var id: String { key }
    let key: String
    let label: String
    let items: [Expense]
    let sum: Int
}

struct CategorySlice: Identifiable {
    var id: String { catId }
    let catId: String
    let name: String
    let icon: String
    let total: Int
    let share: Double
    let color: Color
}

// MARK: - Хранилище

@MainActor
final class Store: ObservableObject {
    @Published private(set) var data: AppData

    private static let fileName = "owls-cash.json"

    private static var fileURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent(fileName)
    }

    init() {
        if let raw = try? Data(contentsOf: Store.fileURL),
           let decoded = try? JSONDecoder().decode(AppData.self, from: raw) {
            data = decoded
        } else {
            data = .seed()
        }
    }

    private func persist() {
        guard let raw = try? JSONEncoder().encode(data) else { return }
        try? raw.write(to: Store.fileURL, options: .atomic)
    }

    private func change(_ block: (inout AppData) -> Void) {
        block(&data)
        data.edits += 1
        persist()
    }

    // MARK: Записи

    func addExpense(amount: Int, catId: String, name: String) {
        let now = Date()
        let row = Expense(id: UUID().uuidString, ts: Fmt.stamp(now), amount: amount,
                          catId: catId, name: name.isEmpty ? (category(catId)?.name ?? "Прочее") : name)
        change { $0.expenses.insert(row, at: 0) }
    }

    func removeExpense(_ id: String) {
        change { $0.expenses.removeAll { $0.id == id } }
    }

    // MARK: Категории

    func category(_ id: String) -> Category? { data.categories.first { $0.id == id } }
    func categoryName(_ id: String) -> String { category(id)?.name ?? "Прочее" }
    func categoryIcon(_ id: String) -> String { category(id)?.icon ?? "ellipsis" }

    var orderedCategories: [Category] { data.categories.sorted { $0.order < $1.order } }
    var visibleCategories: [Category] { orderedCategories.filter { !$0.hidden } }

    func saveCategory(id: String?, name: String, icon: String, hidden: Bool) {
        change { d in
            if let id, let i = d.categories.firstIndex(where: { $0.id == id }) {
                d.categories[i].name = name
                d.categories[i].icon = icon
                d.categories[i].hidden = hidden
            } else {
                let order = (d.categories.map(\.order).max() ?? -1) + 1
                d.categories.append(Category(id: UUID().uuidString, name: name, icon: icon,
                                             order: order, hidden: false))
            }
        }
    }

    func canDeleteCategory(_ id: String) -> Bool {
        !data.expenses.contains { $0.catId == id }
    }

    func deleteCategory(_ id: String) {
        guard canDeleteCategory(id) else { return }
        change { d in
            d.categories.removeAll { $0.id == id }
            let sorted = d.categories.sorted { $0.order < $1.order }
            for (i, c) in sorted.enumerated() {
                if let j = d.categories.firstIndex(where: { $0.id == c.id }) { d.categories[j].order = i }
            }
        }
    }

    func moveCategories(from: IndexSet, to: Int) {
        var list = orderedCategories
        list.move(fromOffsets: from, toOffset: to)
        change { d in
            for (i, c) in list.enumerated() {
                if let j = d.categories.firstIndex(where: { $0.id == c.id }) { d.categories[j].order = i }
            }
        }
    }

    // MARK: Считаем из записей, ничего не храним

    private var sortedExpenses: [Expense] { data.expenses.sorted { $0.ts > $1.ts } }

    var todayExpenses: [Expense] {
        let key = Fmt.dayKey(Date())
        return sortedExpenses.filter { $0.ts.hasPrefix(key) }
    }
    var monthExpenses: [Expense] {
        let key = String(Fmt.dayKey(Date()).prefix(7))
        return sortedExpenses.filter { $0.ts.hasPrefix(key) }
    }
    var todayTotal: Int { todayExpenses.reduce(0) { $0 + $1.amount } }
    var monthTotal: Int { monthExpenses.reduce(0) { $0 + $1.amount } }
    /// Средний расход считается на прошедшие дни месяца.
    var monthAverage: Int {
        let day = Calendar.current.component(.day, from: Date())
        return day > 0 ? monthTotal / day : 0
    }

    var monthTotalsByCategory: [String: Int] {
        var out: [String: Int] = [:]
        for e in monthExpenses { out[e.catId, default: 0] += e.amount }
        return out
    }

    var groups: [DayGroup] {
        var out: [DayGroup] = []
        var currentKey = ""
        var items: [Expense] = []
        func flush() {
            guard !items.isEmpty else { return }
            out.append(DayGroup(key: currentKey, label: Fmt.dayLabel(currentKey),
                                items: items, sum: items.reduce(0) { $0 + $1.amount }))
            items = []
        }
        for e in sortedExpenses {
            let key = String(e.ts.prefix(10))
            if key != currentKey { flush(); currentKey = key }
            items.append(e)
        }
        flush()
        return out
    }

    var slices: [CategorySlice] {
        let totals = monthTotalsByCategory
        let total = monthTotal
        return totals.sorted { $0.value > $1.value }.enumerated().map { i, pair in
            CategorySlice(
                catId: pair.key,
                name: categoryName(pair.key),
                icon: categoryIcon(pair.key),
                total: pair.value,
                share: total > 0 ? Double(pair.value) / Double(total) : 0,
                color: OW.ramp[i % OW.ramp.count]
            )
        }
    }

    // MARK: Копия данных

    var backupDaysAgo: Int? {
        guard !data.backupAt.isEmpty,
              let then = Fmt.dayKeyFormatter.date(from: data.backupAt) else { return nil }
        return Calendar.current.dateComponents([.day], from: then, to: Date()).day
    }

    var backupDue: Bool {
        if data.backupSnooze == Fmt.dayKey(Date()) { return false }
        guard let ago = backupDaysAgo else { return data.edits >= 15 }
        return ago >= 7 && data.edits > 0
    }

    var backupLabel: String {
        guard let ago = backupDaysAgo else { return "Копии ещё не было" }
        switch ago {
        case 0: return "Копия сохранена сегодня"
        case 1: return "Копия сохранена вчера"
        default: return "Копия сохранена \(ago) \(Fmt.plural(ago, "день", "дня", "дней")) назад"
        }
    }

    func snoozeBackup() {
        data.backupSnooze = Fmt.dayKey(Date())
        persist()
    }

    /// Файл копии в том же формате, что у веб-версии.
    func backupFileURL() throws -> URL {
        let payload = BackupFile(app: "owls-cash", version: 1,
                                 savedAt: ISO8601DateFormatter().string(from: Date()),
                                 data: .init(categories: data.categories, expenses: data.expenses))
        let raw = try JSONEncoder().encode(payload)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("OWLS Cash.json")
        try raw.write(to: url, options: .atomic)
        return url
    }

    func markBackupSaved() {
        data.backupAt = Fmt.dayKey(Date())
        data.edits = 0
        data.backupSnooze = ""
        persist()
    }

    func inspectBackup(_ url: URL) throws -> (file: BackupFile, summary: String, when: String) {
        let raw = try Data(contentsOf: url)
        let file = try JSONDecoder().decode(BackupFile.self, from: raw)
        guard file.app == "owls-cash" else {
            throw NSError(domain: "owls", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Это не файл копии OWLS Cash"])
        }
        let e = file.data.expenses.count, c = file.data.categories.count
        let sum = file.data.expenses.reduce(0) { $0 + $1.amount }
        let when: String
        if let d = ISO8601DateFormatter().date(from: file.savedAt) {
            let f = DateFormatter()
            f.locale = Locale(identifier: "ru_RU")
            f.dateFormat = "d MMMM yyyy"
            when = f.string(from: d)
        } else {
            when = "дата неизвестна"
        }
        let summary = "\(e) \(Fmt.plural(e, "запись", "записи", "записей")) на \(Fmt.money(sum)) ₽, "
            + "\(c) \(Fmt.plural(c, "категория", "категории", "категорий"))"
        return (file, summary, when)
    }

    func restore(_ file: BackupFile) {
        data = AppData(categories: file.data.categories, expenses: file.data.expenses,
                       backupAt: Fmt.dayKey(Date()), edits: 0, backupSnooze: "")
        persist()
    }
}
