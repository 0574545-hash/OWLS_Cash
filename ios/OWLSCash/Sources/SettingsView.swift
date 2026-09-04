//  SettingsView.swift
//  Категории и копия данных.

import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// Набор символов для категорий.
let iconChoices = [
    "bag", "cup.and.saucer", "bus", "house", "heart", "tshirt",
    "film", "ellipsis", "cart", "fork.knife", "car", "tram",
    "bicycle", "fuelpump", "gift", "iphone", "book", "graduationcap",
    "pills", "stroller", "dumbbell", "airplane", "wallet.bifold", "creditcard",
    "pawprint", "cat", "dog", "gamecontroller", "music.note", "scissors",
    "wrench.and.screwdriver", "briefcase", "doc.text", "sparkles"
]

struct SettingsView: View {
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss

    @State private var editing: Category?
    @State private var creating = false
    @State private var sharing = false
    @State private var importing = false
    @State private var restoreCandidate: BackupFile?
    @State private var restoreSummary = ""
    @State private var restoreWhen = ""
    @State private var importError: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Категории можно переименовать, скрыть или добавить свою. Порядок здесь задаёт порядок в списке при вводе.")
                        .font(OW.body(12.5))
                        .foregroundStyle(OW.muted)
                        .fixedSize(horizontal: false, vertical: true)

                    categoryList
                    addButton
                    dataCard

                    Text("Данные хранятся на этом устройстве.")
                        .font(OW.body(11.5))
                        .foregroundStyle(OW.faint)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .background(OW.bg)
            .navigationTitle("Настройки")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(OW.ink)
                    }
                }
                ToolbarItem(placement: .principal) {
                    Text("Настройки")
                        .font(OW.display(17))
                        .foregroundStyle(OW.ink)
                }
            }
            .toolbarBackground(OW.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .sheet(item: $editing) { cat in
            CategoryEditor(category: cat)
                .environmentObject(store)
        }
        .sheet(isPresented: $creating) {
            CategoryEditor(category: nil)
                .environmentObject(store)
        }
        .sheet(isPresented: $sharing) { BackupShareSheet() }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            handleImport(result)
        }
        .alert("Файл не подошёл", isPresented: Binding(get: { importError != nil },
                                                       set: { if !$0 { importError = nil } })) {
            Button("Понятно", role: .cancel) { importError = nil }
        } message: {
            Text(importError ?? "")
        }
        .confirmationDialog("Заменить данные?",
                            isPresented: Binding(get: { restoreCandidate != nil },
                                                 set: { if !$0 { restoreCandidate = nil } }),
                            titleVisibility: .visible) {
            Button("Заменить данные", role: .destructive) {
                if let file = restoreCandidate { store.restore(file) }
                restoreCandidate = nil
                dismiss()
            }
            Button("Отмена", role: .cancel) { restoreCandidate = nil }
        } message: {
            Text("Копия от \(restoreWhen): \(restoreSummary). Текущие записи и категории будут заменены, отменить это нельзя.")
        }
    }

    private var categoryList: some View {
        VStack(spacing: 0) {
            ForEach(Array(store.orderedCategories.enumerated()), id: \.element.id) { item in
                let c = item.element
                if item.offset > 0 { OW.lineSoft.frame(height: 1) }
                Button { editing = c } label: {
                    HStack(spacing: 12) {
                        Image(systemName: c.icon)
                            .font(.system(size: 16))
                            .foregroundStyle(c.hidden ? OW.faint : OW.ink)
                            .frame(width: 22)
                        Text(c.name)
                            .font(OW.body(13.5, .semiBold))
                            .foregroundStyle(c.hidden ? OW.faint : OW.ink)
                            .lineLimit(1)
                        if c.hidden {
                            Text("СКРЫТА")
                                .font(OW.body(10, .semiBold))
                                .tracking(0.6)
                                .foregroundStyle(OW.faint)
                        }
                        Spacer(minLength: 8)
                        Text("\(Fmt.money(store.monthTotalsByCategory[c.id] ?? 0)) ₽")
                            .font(OW.body(11.5))
                            .foregroundStyle(OW.faint)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(OW.sand)
                    }
                    .padding(.horizontal, 15)
                    .frame(minHeight: 52)
                    .contentShape(Rectangle())
                }
                .buttonStyle(PressStyle(scale: 0.98))
            }
        }
        .background(OW.card)
        .clipShape(RoundedRectangle(cornerRadius: OW.rCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: OW.rCard, style: .continuous).stroke(OW.line, lineWidth: 1))
    }

    private var addButton: some View {
        Button { creating = true } label: {
            HStack(spacing: 8) {
                Image(systemName: "plus").font(.system(size: 15, weight: .semibold))
                Text("Добавить категорию").font(OW.body(13.5, .semiBold))
            }
            .foregroundStyle(OW.ink)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .overlay(
                RoundedRectangle(cornerRadius: OW.rBig, style: .continuous)
                    .strokeBorder(OW.sand, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
            )
        }
        .buttonStyle(PressStyle(scale: 0.96))
    }

    private var dataCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Копия данных")
                .font(OW.display(13.5))
                .foregroundStyle(OW.ink)
            Text("Файл уходит в «Файлы» → iCloud Drive. Имя всегда одно, поэтому копия заменяется. На новом телефоне тот же файл вернёт всё обратно.")
                .font(OW.body(12))
                .foregroundStyle(OW.muted)
                .fixedSize(horizontal: false, vertical: true)
            Text(store.backupLabel)
                .font(OW.body(12, .semiBold))
                .foregroundStyle(OW.faint)
            Button("Сохранить копию") { sharing = true }
                .buttonStyle(FilledButton())
            Button("Восстановить из копии") { importing = true }
                .buttonStyle(GhostButton())
                .frame(maxWidth: .infinity)
        }
        .owlsCard()
    }

    private func handleImport(_ result: Result<URL, Error>) {
        switch result {
        case .failure:
            importError = "Не удалось открыть файл."
        case .success(let url):
            let needsStop = url.startAccessingSecurityScopedResource()
            defer { if needsStop { url.stopAccessingSecurityScopedResource() } }
            do {
                let info = try store.inspectBackup(url)
                restoreCandidate = info.file
                restoreSummary = info.summary
                restoreWhen = info.when
            } catch let e as NSError where e.domain == "owls" {
                importError = "Это не файл копии OWLS Cash. Нужен файл «OWLS Cash.json», сохранённый из этого приложения."
            } catch {
                importError = "Файл повреждён или это не JSON."
            }
        }
    }
}

// MARK: - Лист категории

struct CategoryEditor: View {
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss

    let category: Category?

    @State private var name = ""
    @State private var icon = "cart"
    @State private var hidden = false
    @State private var confirmDelete = false

    private var isNew: Bool { category == nil }
    private var usedCount: Int {
        guard let id = category?.id else { return 0 }
        return store.data.expenses.filter { $0.catId == id }.count
    }
    private var onlyVisible: Bool {
        guard let c = category else { return false }
        return !c.hidden && store.visibleCategories.count == 1
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Название")
                            .font(OW.body(11.5, .bold))
                            .foregroundStyle(OW.ink2)
                        TextField("например, Подписки", text: $name)
                            .font(OW.body(16))
                            .padding(.horizontal, 12)
                            .frame(height: 46)
                            .background(OW.bg)
                            .clipShape(RoundedRectangle(cornerRadius: OW.rBtn, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: OW.rBtn, style: .continuous).stroke(OW.stone, lineWidth: 1))
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Иконка")
                            .font(OW.body(11.5, .bold))
                            .foregroundStyle(OW.ink2)
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 6), spacing: 8) {
                            ForEach(iconChoices, id: \.self) { n in
                                Button { icon = n } label: {
                                    Image(systemName: n)
                                        .font(.system(size: 17))
                                        .foregroundStyle(icon == n ? OW.ink : OW.ink2)
                                        .frame(maxWidth: .infinity)
                                        .frame(height: 44)
                                        .background(icon == n ? OW.accentSoft : OW.bg)
                                        .clipShape(RoundedRectangle(cornerRadius: OW.rChip, style: .continuous))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: OW.rChip, style: .continuous)
                                                .stroke(icon == n ? OW.accent : OW.stone, lineWidth: 1)
                                        )
                                }
                                .buttonStyle(PressStyle(scale: 0.9))
                            }
                        }
                    }

                    if !isNew {
                        Toggle(isOn: $hidden) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Скрывать при вводе")
                                    .font(OW.body(14, .semiBold))
                                    .foregroundStyle(OW.ink)
                                Text(onlyVisible
                                     ? "Последнюю видимую категорию скрыть нельзя"
                                     : "Записи остаются в истории и на дашборде")
                                    .font(OW.body(11.5))
                                    .foregroundStyle(OW.faint)
                            }
                        }
                        .tint(OW.accent)
                        .disabled(onlyVisible)
                    }

                    Button("Сохранить") {
                        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !trimmed.isEmpty else { return }
                        store.saveCategory(id: category?.id, name: trimmed, icon: icon, hidden: hidden)
                        dismiss()
                    }
                    .buttonStyle(DarkButton())
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    if !isNew {
                        if usedCount > 0 {
                            Text("В категории \(usedCount) \(Fmt.plural(usedCount, "запись", "записи", "записей")), её можно скрыть, но не удалить.")
                                .font(OW.body(12))
                                .foregroundStyle(OW.muted)
                                .frame(maxWidth: .infinity)
                                .multilineTextAlignment(.center)
                        } else {
                            Button("Удалить категорию", role: .destructive) { confirmDelete = true }
                                .buttonStyle(GhostButton())
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
                .padding(20)
            }
            .background(OW.bg)
            .navigationTitle(isNew ? "Новая категория" : "Категория")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").font(.system(size: 14, weight: .semibold))
                    }
                    .tint(OW.ink)
                }
            }
        }
        .presentationDetents([.large])
        .onAppear {
            if let c = category {
                name = c.name; icon = c.icon; hidden = c.hidden
            }
        }
        .confirmationDialog("Удалить категорию?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Удалить", role: .destructive) {
                if let id = category?.id { store.deleteCategory(id) }
                dismiss()
            }
            Button("Отмена", role: .cancel) { }
        }
    }
}

struct DarkButton: ButtonStyle {
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(OW.body(14, .bold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(OW.ink)
            .clipShape(RoundedRectangle(cornerRadius: OW.rBtn, style: .continuous))
            .opacity(enabled ? (configuration.isPressed ? 0.85 : 1) : 0.4)
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(OW.press, value: configuration.isPressed)
    }
}

// MARK: - Отдача файла копии

/// Системное «Поделиться»: оттуда файл кладётся в «Файлы» и iCloud Drive.
struct BackupShareSheet: UIViewControllerRepresentable {
    @EnvironmentObject private var store: Store

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let url = (try? store.backupFileURL()) ?? FileManager.default.temporaryDirectory
        let vc = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        vc.completionWithItemsHandler = { _, completed, _, _ in
            if completed { Task { @MainActor in store.markBackupSaved() } }
        }
        return vc
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
