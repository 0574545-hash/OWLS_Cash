//  HistoryView.swift
//  Все записи по дням. Удаление только долгим нажатием, как велит стандарт.

import SwiftUI
import UIKit

struct HistoryView: View {
    @EnvironmentObject private var store: Store
    @State private var pendingDelete: Expense?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text("История")
                        .font(OW.display(24))
                        .foregroundStyle(OW.ink)
                    Spacer()
                    Text("\(Fmt.money(store.monthTotal)) ₽ за \(Fmt.monthName(Date()))")
                        .font(OW.body(12, .semiBold))
                        .foregroundStyle(OW.muted)
                }
                .padding(.bottom, 12)

                if store.groups.isEmpty {
                    EmptyCard(icon: "tray",
                              title: "Пока пусто",
                              text: "Внесите первый расход на вкладке «Сегодня», здесь появится история по дням.")
                } else {
                    ForEach(store.groups) { group in
                        VStack(spacing: 0) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(group.label.uppercased())
                                    .font(OW.body(11.5, .bold))
                                    .tracking(0.8)
                                    .foregroundStyle(OW.ink)
                                Spacer()
                                Text("\(Fmt.money(group.sum)) ₽")
                                    .font(OW.body(11.5, .semiBold))
                                    .foregroundStyle(OW.muted)
                            }
                            .padding(.horizontal, 2)
                            .padding(.vertical, 8)

                            VStack(spacing: 0) {
                                ForEach(Array(group.items.enumerated()), id: \.element.id) { item in
                                    if item.offset > 0 { OW.lineSoft.frame(height: 1) }
                                    ExpenseRow(expense: item.element)
                                        .contentShape(Rectangle())
                                        .onLongPressGesture(minimumDuration: 0.65) {
                                            UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                                            pendingDelete = item.element
                                        }
                                }
                            }
                            .background(OW.card)
                            .clipShape(RoundedRectangle(cornerRadius: OW.rCard, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: OW.rCard, style: .continuous).stroke(OW.line, lineWidth: 1))
                        }
                        .padding(.bottom, 14)
                    }

                    Text("Чтобы удалить запись, удерживайте строку.")
                        .font(OW.body(11.5))
                        .foregroundStyle(OW.faint)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 120)
        }
        .background(OW.bg)
        .confirmationDialog("Удалить запись?",
                            isPresented: Binding(get: { pendingDelete != nil },
                                                 set: { if !$0 { pendingDelete = nil } }),
                            titleVisibility: .visible) {
            Button("Удалить", role: .destructive) {
                if let e = pendingDelete {
                    withAnimation(OW.base) { store.removeExpense(e.id) }
                }
                pendingDelete = nil
            }
            Button("Отмена", role: .cancel) { pendingDelete = nil }
        } message: {
            if let e = pendingDelete {
                Text("\(e.name), \(Fmt.money(e.amount)) ₽")
            }
        }
    }
}

struct ExpenseRow: View {
    @EnvironmentObject private var store: Store
    let expense: Expense

    private var time: String { String(expense.ts.dropFirst(11).prefix(5)) }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: store.categoryIcon(expense.catId))
                .font(.system(size: 15))
                .foregroundStyle(OW.ink)
                .frame(width: 34, height: 34)
                .background(OW.bg)
                .clipShape(RoundedRectangle(cornerRadius: OW.rTile, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text(expense.name)
                    .font(OW.body(13.5, .semiBold))
                    .foregroundStyle(OW.ink)
                    .lineLimit(1)
                HStack(spacing: 7) {
                    Text(store.categoryName(expense.catId))
                        .font(OW.body(11))
                        .foregroundStyle(OW.muted)
                        .lineLimit(1)
                    Circle().fill(OW.sand).frame(width: 3, height: 3)
                    Text(time)
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundStyle(OW.faint)
                }
            }
            Spacer(minLength: 8)
            Text("\(Fmt.money(expense.amount)) ₽")
                .font(OW.body(14, .bold))
                .foregroundStyle(OW.ink)
                .lineLimit(1)
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 13)
    }
}

struct EmptyCard: View {
    let icon: String
    let title: String
    let text: String

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundStyle(OW.muted)
                .frame(width: 44, height: 44)
                .background(OW.bg)
                .clipShape(Circle())
            Text(title)
                .font(OW.body(13.5, .bold))
                .foregroundStyle(OW.ink)
            Text(text)
                .font(OW.body(12))
                .foregroundStyle(OW.muted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity)
        .owlsCard(EdgeInsets(top: 22, leading: 18, bottom: 22, trailing: 18))
    }
}
