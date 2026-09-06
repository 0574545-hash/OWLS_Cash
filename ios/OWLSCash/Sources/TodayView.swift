//  TodayView.swift
//  Суммы за день и месяц плюс форма внесения расхода.

import SwiftUI
import UIKit

/// Размеры рядов «сот»: не больше трёх в ряду, ряды зеркальные.
/// 8 категорий дают 3/2/3 как в макете, 7 дают 2/3/2, 9 дают 3/3/3.
func honeyRows(_ n: Int) -> [Int] {
    guard n > 3 else { return n > 0 ? [n] : [] }
    let r = Int(ceil(Double(n) / 3))
    let base = n / r, extra = n % r
    let desc = (0..<r).map { $0 < extra ? base + 1 : base }
    func mirror(_ sizes: [Int]) -> [Int] {
        var out = [Int](repeating: 0, count: r)
        var lo = 0, hi = r - 1, k = 0
        while lo <= hi {
            out[lo] = sizes[k]; lo += 1; k += 1
            if lo <= hi { out[hi] = sizes[k]; hi -= 1; k += 1 }
        }
        return out
    }
    let a = mirror(desc), b = mirror(Array(desc.reversed()))
    func isMirror(_ v: [Int]) -> Bool { (0..<r).allSatisfy { v[$0] == v[r - 1 - $0] } }
    return isMirror(a) ? a : (isMirror(b) ? b : a)
}

struct TodayView: View {
    @EnvironmentObject private var store: Store
    let openSettings: () -> Void

    @State private var amount = ""
    @State private var catId: String?
    @State private var comment = ""
    @State private var padOpen = false
    @State private var saving = false
    @FocusState private var nameFocused: Bool

    private var amountValue: Int { Int(amount) ?? 0 }
    private var canSave: Bool { amountValue > 0 && catId != nil }
    private var hint: String {
        canSave ? "готово к внесению" : (amountValue > 0 ? "выберите категорию" : "введите сумму")
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                header
                if store.backupDue { BackupBanner() }
                sums
                form
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 120)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(OW.bg)
    }

    // MARK: Шапка

    private var header: some View {
        HStack {
            Spacer()
            Button(action: openSettings) {
                HStack(spacing: 10) {
                    VStack(alignment: .trailing, spacing: 1) {
                        Text("OWLS Cash")
                            .font(OW.body(15, .bold))
                            .foregroundStyle(OW.ink)
                        Text(Fmt.headerDate(Date()))
                            .font(OW.body(11))
                            .foregroundStyle(OW.muted)
                    }
                    OwlMark(size: 30)
                }
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(PressStyle())
            .accessibilityLabel("Настройки категорий")
        }
        .padding(.bottom, 12)
    }

    // MARK: Две карточки сумм

    private var sums: some View {
        HStack(alignment: .top, spacing: 12) {
            SumCard(title: "Сегодня",
                    value: store.todayTotal,
                    rubleAccent: true,
                    caption: "\(store.todayExpenses.count) \(Fmt.plural(store.todayExpenses.count, "операция", "операции", "операций"))")
            SumCard(title: Fmt.monthName(Date()),
                    value: store.monthTotal,
                    rubleAccent: false,
                    caption: "\(Fmt.money(store.monthAverage)) ₽ в день")
        }
    }

    // MARK: Карточка «Новый расход»

    private var form: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(alignment: .firstTextBaseline) {
                Text("Новый расход")
                    .font(OW.body(13.5, .bold))
                    .foregroundStyle(OW.ink)
                Spacer()
                Text(hint)
                    .font(OW.body(11.5))
                    .foregroundStyle(OW.faint)
            }

            amountField
            if padOpen { numpad }
            categoryPicker
            nameField
            commitButton
        }
        .owlsCard(EdgeInsets(top: 16, leading: 18, bottom: 18, trailing: 18))
    }

    private var amountField: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Label10(text: "Сумма")
                Spacer()
                if padOpen {
                    Button("Готово") { withAnimation(OW.base) { padOpen = false } }
                        .font(OW.body(11.5, .bold))
                        .foregroundStyle(OW.accent)
                }
            }
            Button {
                nameFocused = false
                withAnimation(OW.base) { padOpen = true }
            } label: {
                HStack(alignment: .firstTextBaseline, spacing: 7) {
                    Text(amountValue > 0 ? Fmt.money(amountValue) : "0")
                        .font(OW.display(34))
                        .foregroundStyle(amountValue > 0 ? OW.ink : OW.sand)
                    Text("₽")
                        .font(OW.display(16, .regular))
                        .foregroundStyle(OW.accent)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 15)
                .padding(.vertical, 11)
                .background(padOpen ? OW.card : OW.bg)
                .clipShape(RoundedRectangle(cornerRadius: OW.rBtn, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: OW.rBtn, style: .continuous)
                        .stroke(padOpen ? OW.accent : OW.line, lineWidth: 1)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: OW.rBtn, style: .continuous)
                        .stroke(OW.accent.opacity(padOpen ? 0.18 : 0), lineWidth: 3)
                        .padding(-2)
                )
            }
            .buttonStyle(.plain)
        }
    }

    private var numpad: some View {
        let keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0"]
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
            ForEach(keys, id: \.self) { k in
                Button { press(k) } label: {
                    Text(k)
                        .font(OW.body(21, .semiBold))
                        .foregroundStyle(OW.ink)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(OW.bg)
                        .clipShape(RoundedRectangle(cornerRadius: OW.rKey, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: OW.rKey, style: .continuous).stroke(OW.line, lineWidth: 1))
                }
                .buttonStyle(PressStyle(scale: 0.93))
            }
            Button {
                if !amount.isEmpty { amount.removeLast() }
            } label: {
                Image(systemName: "delete.left")
                    .font(.system(size: 19, weight: .regular))
                    .foregroundStyle(OW.muted)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(OW.bg)
                    .clipShape(RoundedRectangle(cornerRadius: OW.rKey, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: OW.rKey, style: .continuous).stroke(OW.line, lineWidth: 1))
            }
            .buttonStyle(PressStyle(scale: 0.93))
            .accessibilityLabel("Стереть")
        }
        .transition(.opacity.combined(with: .offset(y: 6)))
    }

    private func press(_ key: String) {
        var next = amount + key
        while next.count > 1 && next.hasPrefix("0") { next.removeFirst() }
        guard next.count <= 7 else { return }
        amount = next
    }

    private var categoryPicker: some View {
        let cats = store.visibleCategories
        var slices: [[Category]] = []
        var i = 0
        for size in honeyRows(cats.count) {
            slices.append(Array(cats[i..<min(i + size, cats.count)]))
            i += size
        }
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label10(text: "Категория")
                Spacer()
                Text(catId.flatMap { store.category($0)?.name } ?? "не выбрана")
                    .font(OW.body(11.5, .semiBold))
                    .foregroundStyle(catId == nil ? OW.faint : OW.ink)
                    .lineLimit(1)
            }
            if cats.isEmpty {
                Text("Все категории скрыты. Откройте настройки, чтобы вернуть их.")
                    .font(OW.body(12))
                    .foregroundStyle(OW.faint)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 10)
            } else {
                VStack(spacing: 4) {
                    ForEach(Array(slices.enumerated()), id: \.offset) { item in
                        HStack(spacing: 8) {
                            ForEach(item.element) { c in
                                CategoryCircle(category: c, selected: catId == c.id) {
                                    withAnimation(OW.press) {
                                        catId = (catId == c.id) ? nil : c.id
                                        padOpen = false
                                    }
                                }
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 2)
            }
        }
    }

    private var nameField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label10(text: "Наименование")
            TextField("например, кофе с собой", text: $comment)
                .font(OW.body(16))
                .foregroundStyle(OW.ink)
                .focused($nameFocused)
                .submitLabel(.done)
                .onChange(of: nameFocused) { _, focused in
                    if focused { withAnimation(OW.base) { padOpen = false } }
                }
                .padding(.horizontal, 15)
                .padding(.vertical, 12)
                .background(OW.card)
                .clipShape(RoundedRectangle(cornerRadius: OW.rBtn, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: OW.rBtn, style: .continuous).stroke(OW.line, lineWidth: 1))
        }
    }

    private var commitButton: some View {
        Button(action: commit) {
            HStack(spacing: 9) {
                Image(systemName: saving ? "checkmark" : "plus")
                    .font(.system(size: 17, weight: .bold))
                Text(saving ? "Внесено" : "Внести расход")
                    .font(OW.body(15, .bold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .foregroundStyle(canSave || saving ? Color.white : OW.sand)
            .background(saving ? OW.accentDark : (canSave ? OW.accent : OW.bg))
            .clipShape(RoundedRectangle(cornerRadius: OW.rBig, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: OW.rBig, style: .continuous)
                    .stroke(canSave || saving ? .clear : OW.line, lineWidth: 1)
            )
            .shadow(color: OW.accent.opacity(canSave && !saving ? 0.28 : 0), radius: 9, y: 6)
        }
        .buttonStyle(PressStyle(scale: canSave ? 0.93 : 1))
        .disabled(!canSave || saving)
    }

    /// Кнопка показывает галочку, и через 300 мс запись уходит в список.
    private func commit() {
        guard canSave, let id = catId else { return }
        let value = amountValue
        let text = comment.trimmingCharacters(in: .whitespacesAndNewlines)
        withAnimation(OW.press) { saving = true }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            store.addExpense(amount: value, catId: id, name: text)
            withAnimation(OW.base) {
                saving = false
                amount = ""
                catId = nil
                comment = ""
                padOpen = false
            }
        }
    }
}

// MARK: - Кусочки

struct SumCard: View {
    let title: String
    let value: Int
    let rubleAccent: Bool
    let caption: String

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Label10(text: title, tracking: 0.08)
            HStack(alignment: .top, spacing: 4) {
                Text(Fmt.money(value))
                    .font(OW.display(Fmt.money(value).count > 7 ? 21 : 25))
                    .foregroundStyle(OW.ink)
                    .lineLimit(1)
                Text("₽")
                    .font(OW.display(13, .regular))
                    .foregroundStyle(rubleAccent ? OW.accent : OW.muted)
                    .padding(.top, 2)
            }
            Text(caption)
                .font(OW.body(11))
                .foregroundStyle(OW.muted)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .owlsCard(EdgeInsets(top: 15, leading: 15, bottom: 17, trailing: 15))
    }
}

struct CategoryCircle: View {
    let category: Category
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: category.icon)
                .font(.system(size: 23, weight: .regular))
                .foregroundStyle(selected ? Color.white : OW.ink)
                .frame(width: 60, height: 60)
                .background(selected ? OW.accent : OW.bg)
                .clipShape(Circle())
                .overlay(Circle().stroke(selected ? OW.accent : OW.line, lineWidth: 1))
                .shadow(color: OW.accent.opacity(selected ? 0.3 : 0), radius: 8, y: 6)
                .scaleEffect(selected ? 1.06 : 1)
        }
        .buttonStyle(PressStyle(scale: selected ? 0.99 : 0.92))
        .accessibilityLabel(category.name)
    }
}

/// Напоминание о копии данных.
struct BackupBanner: View {
    @EnvironmentObject private var store: Store
    @State private var sharing = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "externaldrive.badge.icloud")
                    .font(.system(size: 17))
                    .foregroundStyle(OW.accent)
                    .frame(width: 34, height: 34)
                    .background(OW.accentSoft)
                    .clipShape(RoundedRectangle(cornerRadius: OW.rTile, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(store.backupDaysAgo == nil
                         ? "Копии данных ещё не было"
                         : "Копии не было \(store.backupDaysAgo!) \(Fmt.plural(store.backupDaysAgo!, "день", "дня", "дней"))")
                        .font(OW.body(13.5, .bold))
                        .foregroundStyle(OW.ink)
                    Text("Файл в iCloud Drive вернёт всё на новом телефоне.")
                        .font(OW.body(12))
                        .foregroundStyle(OW.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            HStack(spacing: 8) {
                Button("Сохранить копию") { sharing = true }
                    .buttonStyle(FilledButton())
                Button("Позже") { withAnimation(OW.base) { store.snoozeBackup() } }
                    .buttonStyle(GhostButton())
            }
        }
        .owlsCard()
        .sheet(isPresented: $sharing) { BackupShareSheet() }
    }
}

struct FilledButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(OW.body(13.5, .bold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(configuration.isPressed ? OW.accentDark : OW.accent)
            .clipShape(RoundedRectangle(cornerRadius: OW.rBtn, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.93 : 1)
            .animation(OW.press, value: configuration.isPressed)
    }
}

struct GhostButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(OW.body(13.5, .semiBold))
            .foregroundStyle(OW.ink2)
            .padding(.horizontal, 16)
            .frame(height: 44)
            .background(configuration.isPressed ? OW.lineSoft : OW.card)
            .clipShape(RoundedRectangle(cornerRadius: OW.rBtn, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: OW.rBtn, style: .continuous).stroke(OW.stone, lineWidth: 1))
            .scaleEffect(configuration.isPressed ? 0.93 : 1)
            .animation(OW.press, value: configuration.isPressed)
    }
}
