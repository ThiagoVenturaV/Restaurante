# Sistema de Pedidos - Restaurante Sabor & Cia

Sistema completo para gerenciamento de cardápio e pedidos de restaurante desenvolvido em HTML, CSS e JavaScript.

## 📋 Funcionalidades

### Interface Administrativa
- ✅ **Gestão de Cardápio**: Adicionar, editar e remover itens
- ✅ **Pedidos Pendentes**: Visualizar e aprovar/rejeitar pedidos
- ✅ **Pedidos Aceitos**: Visualizar pedidos aprovados
- ✅ **Sistema de Impressão**: Imprimir pedidos em formato de recibo
- ✅ **Histórico**: Acompanhar todos os pedidos com filtros

### Interface do Cliente  
- ✅ **Cardápio Digital**: Navegar pelos itens por categoria
- ✅ **Carrinho**: Adicionar itens e gerenciar quantidades
- ✅ **Finalização**: Inserir dados de entrega e enviar pedido
- ✅ **Acompanhamento**: Ver status dos pedidos em tempo real

## 🚀 Como usar

### 1. Estrutura dos arquivos
```
projeto/
├── index.html      # Arquivo principal
├── styles.css      # Estilos da aplicação
├── script.js       # Lógica da aplicação
└── README.md       # Este arquivo
```

### 2. Executar a aplicação

#### Opção 1: Abrir diretamente no navegador
- Baixe todos os arquivos para uma pasta
- Abra o arquivo `index.html` em qualquer navegador

#### Opção 2: Usar no VSCode com Live Server
1. Instale a extensão "Live Server" no VSCode
2. Abra a pasta do projeto no VSCode
3. Clique com botão direito no `index.html`
4. Selecione "Open with Live Server"

#### Opção 3: Servidor local simples
```bash
# Se tiver Python instalado
python -m http.server 8000

# Se tiver Node.js instalado  
npx http-server
```

### 3. Primeiros passos

1. **Login como Administrador**:
   - Selecione "Administrador"
   - Digite seu nome
   - Gerencie cardápio e pedidos

2. **Login como Cliente**:
   - Selecione "Cliente"  
   - Digite seu nome
   - Navegue pelo cardápio e faça pedidos

## 🎯 Fluxo de Uso

### Para o Restaurante (Admin):
1. Faça login como administrador
2. Cadastre itens no cardápio (nome, descrição, preço, categoria)
3. Monitore pedidos pendentes na aba "Pedidos Pendentes"
4. Aceite ou rejeite pedidos com comentários
5. Imprima pedidos aceitos na aba "Pedidos Aceitos"

### Para o Cliente:
1. Faça login como cliente
2. Navegue pelo cardápio por categorias
3. Adicione itens ao carrinho com quantidades
4. Vá para o carrinho e insira dados de entrega
5. Finalize o pedido
6. Acompanhe o status em "Meus Pedidos"

## 🖨️ Sistema de Impressão

O sistema inclui funcionalidade de impressão otimizada para:
- **Impressoras térmicas** (80mm de largura)
- **Impressoras convencionais**
- **Formato de recibo** com todas as informações necessárias

### Como imprimir:
1. Vá em "Pedidos Aceitos" (admin)
2. Clique em "Imprimir" no pedido desejado
3. Uma janela de impressão será aberta
4. Use Ctrl+P ou clique em "Imprimir"

## ⚙️ Configurações Técnicas

### Tecnologias utilizadas:
- **HTML5**: Estrutura da aplicação
- **CSS3**: Estilos e responsividade
- **JavaScript ES6**: Lógica e interatividade
- **Font Awesome**: Ícones
- **CSS Grid/Flexbox**: Layout responsivo

### Dados iniciais:
A aplicação vem com:
- 6 itens no cardápio de exemplo
- 2 pedidos de demonstração
- Categorias: Pratos Principais, Entradas, Bebidas, Sobremesas

### Armazenamento:
- **Dados em memória**: Todos os dados são mantidos apenas durante a sessão
- **Sem banco de dados**: Aplicação funciona completamente offline
- **Reset ao recarregar**: Dados voltam ao estado inicial

## 📱 Responsividade

A aplicação é totalmente responsiva e funciona em:
- **Desktop** (1200px+)
- **Tablet** (768px - 1199px)  
- **Mobile** (até 767px)

---

**Desenvolvido para demonstração de sistema de pedidos de restaurante**