//  RootView.swift
//  Три вкладки и таб-бар. Переход между вкладками кроссфейдом со сдвигом
//  со стороны нажатой вкладки, как задано стандартом OWLS.

import SwiftUI

enum Tab: Int, CaseIterable {
    case today, history, dash

    var title: String {
        switch self {
        case .today: return "Сегодня"
        case .history: return "История"
        case .dash: return "Дашборд"
        }
    }
    var icon: String {
        switch self {
        case .today: return "calendar"
        case .history: return "list.bullet"
        case .dash: return "chart.bar"
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var store: Store
    @State private var tab: Tab = .today
    @State private var showSettings = false

    var body: some View {
        ZStack(alignment: .bottom) {
            OW.bg.ignoresSafeArea()

            Group {
                switch tab {
                case .today: TodayView(openSettings: { showSettings = true })
                case .history: HistoryView()
                case .dash: DashboardView()
                }
            }
            .id(tab)
            .transition(.asymmetric(
                insertion: .opacity.combined(with: .offset(x: 28)),
                removal: .opacity.combined(with: .offset(x: -28))
            ))

            TabBar(tab: $tab)
        }
        .animation(OW.screen, value: tab)
        .fullScreenCover(isPresented: $showSettings) {
            SettingsView()
                .environmentObject(store)
        }
    }
}

struct TabBar: View {
    @Binding var tab: Tab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases, id: \.rawValue) { t in
                Button {
                    tab = t
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: t.icon)
                            .font(.system(size: 19, weight: .medium))
                        Text(t.title)
                            .font(OW.body(10.5, .semiBold))
                    }
                    .foregroundStyle(tab == t ? OW.accent : OW.faint)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 11)
                    .frame(height: 62, alignment: .top)
                    .contentShape(Rectangle())
                }
                .buttonStyle(PressStyle(scale: 0.9))
            }
        }
        .background(
            OW.card
                .overlay(OW.line.frame(height: 1), alignment: .top)
                .ignoresSafeArea(edges: .bottom)
        )
    }
}
