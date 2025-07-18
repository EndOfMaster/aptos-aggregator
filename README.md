# Aptos 去中心化交易所聚合器

项目名称

Aptos 去中心化交易所聚合器。

项目描述

一个去中心化的交易所和交易对聚合器在 Aptos 区块链上的实现。在多种去中心化交易所中寻找最优的交易来解决高价和交易滑点的问题。

项目包括 Move 智能合约，后端寻导器 (Router)，以及 TypeScript SDK。

Aptos 区块链集成

使用 Cetus AMM 在 Aptos 上的功能实现在 Aptos 区块链上进行去中心化交易对的开发与去中心化交易所聚合器的实现。

技术栈

Move、Typescript。

安装与运行指南

Windows 执行 deploy.ps1。

Linux/macOS 执行 deploy.sh。

或者手动编译部署合约，如执行 `aptos move compile --named-addresses aggregator=default`。

项目亮点/创新点

实现 Aptos 中缺失的去中心化交易所聚合器部分。
