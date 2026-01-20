let nodesData = [];
let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000; 
let currentModal = null;
let nodesList = [];

function getOpenAccordions() {
    const openAccordions = [];
    document.querySelectorAll('.node-row').forEach(row => {
        const toggle = row.querySelector('.accordion-toggle');
        if (toggle && toggle.checked) {
            const nodeId = toggle.id.replace('node-', '');
            openAccordions.push(nodeId);
        }
    });
    console.log(`Acordeones abiertos: ${openAccordions.join(', ')}`);
    return openAccordions;
}

function openAccordion(nodeId) {
    const toggle = document.getElementById(`node-${nodeId}`);
    if (!toggle) return;
    
    const content = toggle.closest('.node-row')?.querySelector('.accordion-content');
    const arrow = toggle.closest('.node-row')?.querySelector('.accordion-arrow');
    
    if (content && arrow) {
        toggle.checked = true;
        content.classList.remove('hidden');
        content.style.maxHeight = content.scrollHeight + 'px';
        arrow.classList.add('rotate-180');
    }
}

function setupAccordionEvents() {
    document.querySelectorAll('.accordion-toggle').forEach(toggle => {
        const content = toggle.closest('.node-row')?.querySelector('.accordion-content');
        const arrow = toggle.closest('.node-row')?.querySelector('.accordion-arrow');
        
        if (content && arrow) {
            if (toggle.changeHandler) {
                toggle.removeEventListener('change', toggle.changeHandler);
            }
            
            toggle.changeHandler = function() {
                if (this.checked) {
                    content.classList.remove('hidden');
                    arrow.classList.add('rotate-180');
                    content.style.maxHeight = content.scrollHeight + 'px';
                } else {
                    content.classList.add('hidden');
                    arrow.classList.remove('rotate-180');
                    content.style.maxHeight = '0px';
                }
            };
            
            toggle.addEventListener('change', toggle.changeHandler);
            
            if (toggle.checked) {
                content.classList.remove('hidden');
                arrow.classList.add('rotate-180');
                content.style.maxHeight = content.scrollHeight + 'px';
            }
        }
    });
}

function renderDevicesHTML(devices) {
    if (!devices || devices.length === 0) {
        return '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No hay dispositivos</td></tr>';
    }

    return devices.map(device => {
        let deviceStatusClass, deviceStatusText, deviceStatusDot;
        switch (device.status) {
            case "online":
                deviceStatusClass = "text-green-800 dark:text-green-400 bg-green-100 dark:bg-green-900/30";
                deviceStatusText = "En línea";
                deviceStatusDot = "online";
                break;
            case "offline":
                deviceStatusClass = "text-red-800 dark:text-red-400 bg-red-100 dark:bg-red-900/30";
                deviceStatusText = "Fuera de línea";
                deviceStatusDot = "offline";
                break;
            case "warning":
                deviceStatusClass = "text-yellow-800 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30";
                deviceStatusText = "Con problemas";
                deviceStatusDot = "warning";
                break;
            default:
                deviceStatusClass = "text-gray-800 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30";
                deviceStatusText = "Desconocido";
                deviceStatusDot = "offline";
                break;
        }

        const additionalInfo = device.latency
            ? `Latencia: ${device.latency}ms`
            : device.error
            ? `Error: ${device.error.substring(0, 30)}...`
            : "";

        return `
            <tr class="device-row ${device.status === "online" ? "device-updating" : ""}" id="device-${device.id}">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-8 w-8 rounded-md bg-gray-100 dark:bg-dark-100 flex items-center justify-center ml-4">
                            <i class="fas fa-server text-gray-500 dark:text-gray-400 text-sm"></i>
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900 dark:text-white">${escapeHtml(device.name)}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">${escapeHtml(device.description || '')}</div>
                            ${additionalInfo ? `<div class="text-xs text-gray-400 dark:text-gray-500 mt-1">${escapeHtml(additionalInfo)}</div>` : ""}
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900 dark:text-white">${device.ip}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">Puerto ${device.port}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${deviceStatusClass}">
                        <span class="status-dot ${deviceStatusDot}"></span>
                        ${deviceStatusText}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    ${device.lastCheck}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 mr-3" onclick="editDevice(${device.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" onclick="deleteDevice(${device.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function editNode(nodeId, nodeName) {
    let modal = document.getElementById('editNodeModal');
    if (!modal) {
        createEditNodeModal();
        modal = document.getElementById('editNodeModal');
    }
    
    document.getElementById('editNodeId').value = nodeId;
    document.getElementById('editNodeName').value = nodeName;
    const errorElement = document.getElementById('editNodeError');
    if (errorElement) {
        errorElement.classList.add('hidden');
        errorElement.textContent = '';
    }
    
    modal.classList.remove('hidden');
    currentModal = 'edit_node';
    
    setTimeout(() => {
        const nameInput = document.getElementById('editNodeName');
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }, 100);
}

function editDevice(deviceId) {
    let deviceData = null;
    let nodeData = null;
    
    for (const node of nodesData) {
        const device = node.devices.find(d => d.id == deviceId);
        if (device) {
            deviceData = device;
            nodeData = node;
            break;
        }
    }
    
    if (!deviceData) {
        showNotification("Dispositivo no encontrado en datos locales", "error");
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'get_device',
                id: deviceId
            }));
        }
        return;
    }
    
    let modal = document.getElementById('editDeviceModal');
    if (!modal) {
        createEditDeviceModal();
        modal = document.getElementById('editDeviceModal');
    }
    
    document.getElementById('editDeviceId').value = deviceId;
    document.getElementById('editDeviceName').value = deviceData.name;
    document.getElementById('editDeviceIp').value = deviceData.ip;
    document.getElementById('editDevicePort').value = deviceData.port;
    document.getElementById('editDeviceDescription').value = deviceData.description || '';
    
    loadNodesForSelect('editDeviceNode');
    setTimeout(() => {
        const nodeSelect = document.getElementById('editDeviceNode');
        if (nodeSelect && nodeData) {
            nodeSelect.value = nodeData.id;
        }
    }, 100);
    
    const errorElement = document.getElementById('editDeviceError');
    if (errorElement) {
        errorElement.classList.add('hidden');
        errorElement.textContent = '';
    }
    
    modal.classList.remove('hidden');
    currentModal = 'edit_device';
    
    setTimeout(() => {
        const nameInput = document.getElementById('editDeviceName');
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }, 100);
}

function updateNode() {
    const nodeId = document.getElementById('editNodeId').value;
    const nodeName = document.getElementById('editNodeName').value.trim();
    const errorElement = document.getElementById('editNodeError');
    
    if (!nodeName) {
        if (errorElement) {
            errorElement.textContent = 'Por favor, ingresa un nombre para el nodo';
            errorElement.classList.remove('hidden');
        }
        return;
    }
    
    if (nodeName.length > 100) {
        if (errorElement) {
            errorElement.textContent = 'El nombre del nodo no puede exceder los 100 caracteres';
            errorElement.classList.remove('hidden');
        }
        return;
    }
    
    if (errorElement) {
        errorElement.classList.add('hidden');
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        showNotification('Actualizando nodo...', 'info');
        
        ws.send(JSON.stringify({
            type: 'update_node',
            id: parseInt(nodeId),
            name: nodeName
        }));
        
        closeEditNodeModal();
    } else {
        if (errorElement) {
            errorElement.textContent = 'No hay conexión con el servidor. Intenta de nuevo.';
            errorElement.classList.remove('hidden');
        }
        showNotification('Error de conexión', 'error');
    }
}

function updateDevice() {
    const deviceId = document.getElementById('editDeviceId').value;
    const name = document.getElementById('editDeviceName').value.trim();
    const ip = document.getElementById('editDeviceIp').value.trim();
    const port = document.getElementById('editDevicePort').value.trim();
    const nodeId = document.getElementById('editDeviceNode').value;
    const description = document.getElementById('editDeviceDescription').value.trim();
    const errorElement = document.getElementById('editDeviceError');
    
    let errors = [];
    
    if (!name) errors.push('El nombre del dispositivo es requerido');
    if (!ip) errors.push('La dirección IP es requerida');
    if (!port) errors.push('El puerto es requerido');
    if (!nodeId) errors.push('Debes seleccionar un nodo');
    
    if (ip && !isValidIP(ip)) {
        errors.push('La dirección IP no tiene un formato válido');
    }
    
    const portNum = parseInt(port);
    if (port && (isNaN(portNum) || portNum < 1 || portNum > 65535)) {
        errors.push('El puerto debe ser un número entre 1 y 65535');
    }
    
    if (errors.length > 0) {
        if (errorElement) {
            errorElement.textContent = errors.join(', ');
            errorElement.classList.remove('hidden');
        }
        return;
    }
    
    if (errorElement) {
        errorElement.classList.add('hidden');
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        showNotification('Actualizando dispositivo...', 'info');
        
        ws.send(JSON.stringify({
            type: 'update_device',
            id: parseInt(deviceId),
            name: name,
            ip: ip,
            port: portNum,
            node_id: parseInt(nodeId),
            description: description || ''
        }));
        
        closeEditDeviceModal();
    } else {
        if (errorElement) {
            errorElement.textContent = 'No hay conexión con el servidor';
            errorElement.classList.remove('hidden');
        }
        showNotification('Error de conexión', 'error');
    }
}

function deleteDevice(deviceId) {
    if (confirm(`¿Estás seguro de eliminar este dispositivo?`)) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(
                JSON.stringify({
                    type: "delete_device",
                    id: deviceId,
                })
            );
            showNotification('Eliminando dispositivo...', 'info');
        } else {
            showNotification("No hay conexión con el servidor", "error");
            connectWebSocket();
        }
    }
}

function deleteNode(nodeId) {
    const node = nodesData.find(n => n.id == nodeId);
    if (!node) return;
    
    const deviceCount = node.devices.length;
    const message = deviceCount > 0 
        ? `¿Estás seguro de eliminar el nodo "${node.name}" y sus ${deviceCount} dispositivos? Esta acción no se puede deshacer.`
        : `¿Estás seguro de eliminar el nodo "${node.name}"?`;
    
    if (confirm(message)) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'delete_node',
                id: nodeId
            }));
            showNotification('Eliminando nodo...', 'info');
        } else {
            showNotification('No hay conexión con el servidor', 'error');
            connectWebSocket();
        }
    }
}

function createEditNodeModal() {
    const modalHTML = `
    <div id="editNodeModal" class="fixed inset-0 overflow-y-auto hidden z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onclick="closeEditNodeModal()"></div>
            
            <div class="inline-block align-bottom bg-white dark:bg-dark-200 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div class="bg-white dark:bg-dark-200 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div class="sm:flex sm:items-start">
                        <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 sm:mx-0 sm:h-10 sm:w-10">
                            <i class="fas fa-sitemap text-blue-600 dark:text-blue-400"></i>
                        </div>
                        <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                            <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                                Editar Nodo
                            </h3>
                            <div class="mt-4">
                                <div class="space-y-4">
                                    <input type="hidden" id="editNodeId">
                                    <div>
                                        <label for="editNodeName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Nombre del Nodo
                                        </label>
                                        <input type="text" id="editNodeName"
                                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-100 dark:text-white"
                                            placeholder="Nombre del nodo">
                                        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            Edita el nombre del nodo
                                        </p>
                                        <div id="editNodeError" class="mt-1 text-sm text-red-600 dark:text-red-400 hidden"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="bg-gray-50 dark:bg-dark-100 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button type="button" onclick="updateNode()"
                        class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm">
                        Actualizar Nodo
                    </button>
                    <button type="button" onclick="closeEditNodeModal()"
                        class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-dark-200 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function createEditDeviceModal() {
    const modalHTML = `
    <div id="editDeviceModal" class="fixed inset-0 overflow-y-auto hidden z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onclick="closeEditDeviceModal()"></div>
            
            <div class="inline-block align-bottom bg-white dark:bg-dark-200 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div class="bg-white dark:bg-dark-200 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div class="sm:flex sm:items-start">
                        <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 sm:mx-0 sm:h-10 sm:w-10">
                            <i class="fas fa-server text-blue-600 dark:text-blue-400"></i>
                        </div>
                        <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                            <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                                Editar Dispositivo
                            </h3>
                            <div class="mt-4">
                                <div class="space-y-4">
                                    <input type="hidden" id="editDeviceId">
                                    <div>
                                        <label for="editDeviceName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Nombre del Dispositivo
                                        </label>
                                        <input type="text" id="editDeviceName"
                                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-100 dark:text-white"
                                            placeholder="Nombre del dispositivo">
                                    </div>
                                    
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <label for="editDeviceIp" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Dirección IP
                                            </label>
                                            <input type="text" id="editDeviceIp"
                                                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-100 dark:text-white"
                                                placeholder="Ej: 192.168.1.1">
                                        </div>
                                        <div>
                                            <label for="editDevicePort" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Puerto
                                            </label>
                                            <input type="number" id="editDevicePort" min="1" max="65535"
                                                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-100 dark:text-white"
                                                placeholder="Ej: 80">
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label for="editDeviceNode" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Nodo Asignado
                                        </label>
                                        <select id="editDeviceNode"
                                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-100 dark:text-white">
                                            <option value="">Seleccionar nodo</option>
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label for="editDeviceDescription" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Descripción (Opcional)
                                        </label>
                                        <textarea id="editDeviceDescription" rows="2"
                                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-100 dark:text-white"
                                            placeholder="Descripción del dispositivo"></textarea>
                                    </div>
                                    
                                    <div id="editDeviceError" class="mt-1 text-sm text-red-600 dark:text-red-400 hidden"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="bg-gray-50 dark:bg-dark-100 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button type="button" onclick="updateDevice()"
                        class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm">
                        Actualizar Dispositivo
                    </button>
                    <button type="button" onclick="closeEditDeviceModal()"
                        class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-dark-200 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeEditNodeModal() {
    const modal = document.getElementById('editNodeModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentModal = null;
}

function closeEditDeviceModal() {
    const modal = document.getElementById('editDeviceModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentModal = null;
}

function loadNodesForSelect(selectId = 'deviceNode') {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) {
        console.warn(`Elemento ${selectId} no encontrado`);
        return;
    }
    
    const currentValue = selectElement.value;
    
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }
    
    if (nodesList && nodesList.length > 0) {
        nodesList.forEach(node => {
            const option = document.createElement('option');
            option.value = node.ID || node.id;
            option.textContent = node.NAME || node.name || `Nodo ${node.ID || node.id}`;
            selectElement.appendChild(option);
        });
        
        if (currentValue) {
            selectElement.value = currentValue;
        }
    } else {
        requestNodesList();
    }
}

function requestNodesList() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "get_nodes" }));
  }
}

function updateNodesSelect(nodes) {
  const nodeSelect = document.getElementById("deviceNode");
  if (!nodeSelect) {
    console.warn("Elemento deviceNode no encontrado");
    return;
  }

  nodeSelect.innerHTML = '<option value="">Seleccionar nodo</option>';

  if (nodes && Array.isArray(nodes)) {
    nodes.forEach((node) => {
      const option = document.createElement("option");
      option.value = node.ID || node.id;
      option.textContent =
        node.NAME || node.name || `Nodo ${node.ID || node.id}`;
      nodeSelect.appendChild(option);
    });
  }
}

function handleNodeUpdate(data) {
  switch (data.action) {
    case "added":
      showNotification(`Nodo "${data.node?.name}" agregado`, "success");
      requestNodesList();
      break;
    case "deleted":
      showNotification(`Nodo eliminado`, "info");
      nodesData = nodesData.filter((node) => node.id !== data.node_id);
      renderNodesTable(nodesData);
      break;
    case "updated":
      showNotification(`Nodo actualizado exitosamente`, "success");
      const updatedNodeIndex = nodesData.findIndex(n => n.id == data.node.id);
      if (updatedNodeIndex !== -1) {
          nodesData[updatedNodeIndex].name = data.node.name;
      }
      requestNodesList();
      break;
  }
}

function handleDeviceUpdate(data) {
  switch (data.action) {
    case "deleted":
      const deviceRow = document.getElementById(`device-${data.device_id}`);
      if (deviceRow) {
        deviceRow.remove();
      }
      nodesData.forEach((node) => {
        node.devices = node.devices.filter(
          (device) => device.id !== data.device_id
        );
      });
      break;
  }
}

function updateSingleDeviceStatus(device) {
  const deviceRow = document.getElementById(`device-${device.id}`);
  if (deviceRow) {
    const statusCell = deviceRow.querySelector("td:nth-child(3)");
    if (statusCell) {
      const statusClass =
        device.status === "online"
          ? "text-green-800 dark:text-green-400 bg-green-100 dark:bg-green-900/30"
          : "text-red-800 dark:text-red-400 bg-red-100 dark:bg-red-900/30";

      statusCell.innerHTML = `
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
          <span class="status-dot ${
            device.status === "online" ? "online" : "offline"
          }"></span>
          ${device.status === "online" ? "En línea" : "Fuera de línea"}
        </span>
      `;

      const lastCheckCell = deviceRow.querySelector("td:nth-child(4)");
      if (lastCheckCell && device.last_check) {
        lastCheckCell.textContent = device.last_check;
      }

      deviceRow.classList.add("device-updating");
      setTimeout(() => {
        deviceRow.classList.remove("device-updating");
      }, 1000);
    }
  }
}

function connectWebSocket() {
  try {
    const wsHost = "127.0.0.1";
    const wsPort = 8080;
    const wsUrl = `ws://${wsHost}:${wsPort}`;

    console.log("Intentando conectar a:", wsUrl);

    const connectionInfo = document.getElementById("connectionInfo");
    if (connectionInfo) {
      connectionInfo.textContent = `Conectando a ${wsUrl}...`;
    } else {
      console.warn("Elemento connectionInfo no encontrado");
    }

    ws = new WebSocket(wsUrl);

    ws.onopen = function () {
      console.log("WebSocket conectado a", wsUrl);
      updateConnectionStatus("connected", "Conectado al servidor");
      reconnectAttempts = 0;

      setTimeout(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "force_check" }));
        }
      }, 1000);
    };

    ws.onmessage = function (event) {
      console.log(
        "Mensaje RAW recibido:",
        typeof event.data,
        "longitud:",
        event.data.length
      );

      try {
        const data = JSON.parse(event.data);
        console.log("JSON parseado correctamente, tipo:", data.type);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error("Error parseando mensaje WebSocket:", error.message);
        console.log("Contenido del mensaje:", event.data);

        try {
          const cleaned = event.data
            .replace(/'/g, '"')
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');

          const data = JSON.parse(cleaned);
          console.log("JSON reparado, tipo:", data.type);
          handleWebSocketMessage(data);
        } catch (secondError) {
          console.error("No se pudo reparar el JSON:", secondError.message);
          showNotification("Error en formato de datos del servidor", "error");
        }
      }
    };

    ws.onclose = function (event) {
      console.log("WebSocket desconectado", event.code, event.reason);
      updateConnectionStatus("disconnected", "Desconectado del servidor");

      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(reconnectDelay * reconnectAttempts, 30000);
        console.log(
          `Intentando reconectar en ${
            delay / 1000
          } segundos (intento ${reconnectAttempts}/${maxReconnectAttempts})...`
        );
        updateConnectionStatus(
          "reconnecting",
          `Reconectando en ${delay / 1000}s...`
        );

        setTimeout(connectWebSocket, delay);
      } else {
        updateConnectionStatus("failed", "No se pudo conectar al servidor");
      }
    };

    ws.onerror = function (error) {
      console.error("Error en WebSocket:", error);
      updateConnectionStatus("error", "Error de conexión");
    };
  } catch (error) {
    console.error("Error al crear WebSocket:", error);
    updateConnectionStatus("error", "Error al crear conexión");
  }
}

function updateConnectionStatus(status, message = "") {
  const wsStatus = document.getElementById("wsStatus");
  const connectionInfo = document.getElementById("connectionInfo");

  if (!wsStatus || !connectionInfo) {
    console.warn("Elementos wsStatus o connectionInfo no encontrados");
    return;
  }

  switch (status) {
    case "connected":
      wsStatus.innerHTML = '<i class="fas fa-plug mr-1"></i> Conectado';
      wsStatus.className =
        "ml-4 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      connectionInfo.textContent = "Conectado al servidor de monitoreo";
      break;

    case "disconnected":
      wsStatus.innerHTML = '<i class="fas fa-plug mr-1"></i> Desconectado';
      wsStatus.className =
        "ml-4 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      connectionInfo.textContent = message;
      break;

    case "reconnecting":
      wsStatus.innerHTML =
        '<i class="fas fa-sync-alt mr-1 animate-spin"></i> Reconectando...';
      wsStatus.className =
        "ml-4 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      connectionInfo.textContent = message;
      break;

    case "error":
    case "failed":
      wsStatus.innerHTML =
        '<i class="fas fa-exclamation-triangle mr-1"></i> Error';
      wsStatus.className =
        "ml-4 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      connectionInfo.textContent = message;
      break;
  }
}

function handleWebSocketMessage(data) {
  if (!data || !data.type) {
    console.warn("Mensaje WebSocket sin tipo:", data);
    return;
  }

  console.log("Mensaje recibido:", data.type);

  switch (data.type) {
    case "welcome":
      console.log("Servidor dice:", data.message);
      showNotification(
        `Conectado al servidor como cliente #${data.client_id}`,
        "success"
      );
      break;

    case "initial_data":
      handleInitialData(data);
      break;

    case "devices_update":
      handleDevicesUpdate(data);
      break;

    case "nodes_list":
      updateNodesSelect(data.data);
      updateNodesList(data.data);
      break;

    case "node_added":
      showNotification(data.message || "Nodo agregado exitosamente", "success");
      requestNodesList();
      break;

    case "node_updated":
      showNotification(data.message || "Nodo actualizado exitosamente", "success");
      const updatedNodeIndex = nodesData.findIndex(n => n.id == data.id);
      if (updatedNodeIndex !== -1) {
          nodesData[updatedNodeIndex].name = data.name;
      }
      requestNodesList();
      break;

    case "device_added":
      showNotification(
        data.message || "Dispositivo agregado exitosamente",
        "success"
      );
      break;

    case "device_updated":
      showNotification(
        data.message || "Dispositivo actualizado exitosamente",
        "success"
      );
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'force_check' }));
      }
      break;

    case "device_deleted":
      showNotification(
        data.message || "Dispositivo eliminado exitosamente",
        "info"
      );
      break;

    case "node_deleted":
      showNotification(data.message || "Nodo eliminado exitosamente", "info");
      requestNodesList();
      break;

    case "node_update":
      handleNodeUpdate(data);
      break;

    case "device_update":
      handleDeviceUpdate(data);
      break;

    case "device_status_update":
      updateSingleDeviceStatus(data.device);
      break;

    case "error":
      console.error("Error del servidor:", data.message);
      showNotification(
        `Error: ${data.message || "Error desconocido"}`,
        "error"
      );
      break;

    case "pong":
      console.log("Pong recibido");
      break;

    default:
      console.warn("Tipo de mensaje no manejado:", data.type);
      break;
  }
}

function handleInitialData(data) {
  console.log("Datos iniciales recibidos");
  nodesData = data.data || [];
  renderNodesTable(nodesData);

  if (data.total_devices !== undefined) {
    document.getElementById("totalDevicesCount").textContent =
      data.total_devices;
    document.getElementById("onlineDevicesCount").textContent =
      data.total_online || 0;
    document.getElementById("offlineDevicesCount").textContent =
      data.total_offline || 0;
    document.getElementById("activeNodesCount").textContent =
      data.total_nodes || nodesData.length;
  }

  if (data.timestamp) {
    document.getElementById(
      "lastUpdate"
    ).textContent = `Última actualización: ${data.timestamp}`;
  }

  showNotification("Datos iniciales cargados", "success");
}

function handleDevicesUpdate(data) {
  console.log("handleDevicesUpdate - Datos completos:", JSON.stringify(data, null, 2));
  
  const previouslyOpenAccordions = getOpenAccordions();
  
  const refreshSpinner = document.getElementById("refreshSpinner");
  if (refreshSpinner) refreshSpinner.classList.add("hidden");

  updateStatistics(data);

  let groupedData = [];
  
  if (data.data && Array.isArray(data.data)) {
    groupedData = data.data.map(node => ({
      id: node.id || node.ID || 0,
      name: node.name || node.NAME || `Nodo ${node.id || 0}`,
      status: node.status || 'unknown',
      devices: (node.devices || []).map(device => ({
        id: device.id || device.ID,
        name: device.name || device.NAME || `Dispositivo ${device.id || 'N/A'}`,
        ip: device.ip || device.IP || '127.0.0.1',
        port: device.port || device.PORT || 80,
        status: device.status || 'offline',
        latency: device.latency || 0,
        lastCheck: device.last_check || device.lastCheck || 'Nunca',
        description: device.description || 
                    (device.status === 'online' ? 'Monitoreado' : 'Sin datos'),
        error: device.error || ''
      }))
    }));
  }
  
  nodesData = groupedData;
  console.log("Datos procesados para renderizar:", groupedData);

  renderNodesTablePreservingAccordions(groupedData, previouslyOpenAccordions);

  showNotification(
    `Actualización: ${data.total_online || 0} en línea, ${data.total_offline || 0} fuera de línea`,
    "info"
  );
}

function updateStatistics(data) {
  document.getElementById("totalDevicesCount").textContent = data.total_devices || 0;
  document.getElementById("onlineDevicesCount").textContent = data.total_online || 0;
  document.getElementById("offlineDevicesCount").textContent = data.total_offline || 0;
  document.getElementById("lastUpdate").textContent = `Última actualización: ${data.timestamp || 'N/A'}`;
  document.getElementById("activeNodesCount").textContent = data.total_nodes || 0;
}

function groupDevicesByNode(devices) {
  console.log("groupDevicesByNode recibió:", devices);
  
  if (!devices || !Array.isArray(devices)) {
    console.warn("devices no es array en groupDevicesByNode:", devices);
    return [];
  }

  const nodes = {};

  devices.forEach((device) => {
    if (device.node_id && device.node_name) {
      const nodeId = device.node_id;
      
      if (!nodes[nodeId]) {
        nodes[nodeId] = {
          id: nodeId,
          name: device.node_name,
          devices: [],
        };
      }

      nodes[nodeId].devices.push({
        id: device.id || device.ID,
        name: device.name || device.NAME,
        ip: device.ip || device.IP,
        port: device.port || device.PORT,
        status: device.status || "offline",
        latency: device.latency || 0,
        lastCheck: device.last_check || "Nunca",
        description: device.description || 
                    (device.status === "online" ? "Monitoreado" : "Sin datos"),
      });
    }
  });

  const result = Object.values(nodes);
  console.log(`groupDevicesByNode retornó ${result.length} nodos`);
  return result;
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-0 ${
    type === "success"
      ? "bg-green-500 text-white"
      : type === "error"
      ? "bg-red-500 text-white"
      : "bg-primary-500 text-white"
  }`;
  notification.innerHTML = `
                <div class="flex items-center">
                    <i class="fas ${
                      type === "success"
                        ? "fa-check-circle"
                        : type === "error"
                        ? "fa-exclamation-circle"
                        : "fa-info-circle"
                    } mr-3"></i>
                    <span>${escapeHtml(message)}</span>
                </div>
            `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add("translate-x-full");
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 5000);
}

function forceCheck() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const refreshSpinner = document.getElementById("refreshSpinner");
    if (refreshSpinner) {
      refreshSpinner.classList.remove("hidden");
    }
    ws.send(JSON.stringify({ type: "force_check" }));
    showNotification("Solicitando chequeo manual...", "info");
  } else {
    showNotification("No hay conexión con el servidor", "error");
    connectWebSocket();
  }
}

function renderNodesTable(nodes) {
  const nodesTable = document.getElementById("nodesTable");
  if (!nodesTable) {
    console.error("Elemento nodesTable no encontrado");
    return;
  }

  const previouslyOpenAccordions = getOpenAccordions();
  
  console.log("Renderizando tabla con nodos:", nodes);
  
  nodesTable.innerHTML = "";

  if (!nodes || nodes.length === 0) {
    nodesTable.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-12 text-center">
          <i class="fas fa-search text-gray-400 dark:text-gray-500 text-3xl mb-3"></i>
          <p class="text-gray-500 dark:text-gray-400">No se encontraron dispositivos monitoreados.</p>
          <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">El servidor podría estar escaneando dispositivos...</p>
        </td>
      </tr>
    `;
    updateCounts(0, 0);
    return;
  }

  let totalDevices = 0;
  console.log(`Renderizando ${nodes.length} nodos`);

  nodes.forEach((node) => {
    totalDevices += node.devices.length;

    let nodeStatusClass, nodeStatusText, nodeStatusDot;
    switch (node.status) {
      case "online":
        nodeStatusClass =
          "text-green-800 dark:text-green-400 bg-green-100 dark:bg-green-900/30";
        nodeStatusText = "Operacional";
        nodeStatusDot = "online";
        break;
      case "offline":
        nodeStatusClass =
          "text-red-800 dark:text-red-400 bg-red-100 dark:bg-red-900/30";
        nodeStatusText = "Inactivo";
        nodeStatusDot = "offline";
        break;
      case "warning":
        nodeStatusClass =
          "text-yellow-800 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30";
        nodeStatusText = "Con problemas";
        nodeStatusDot = "warning";
        break;
      default:
        nodeStatusClass =
          "text-gray-800 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30";
        nodeStatusText = "Desconocido";
        nodeStatusDot = "offline";
        break;
    }

    const nodeRow = document.createElement("tr");
    nodeRow.className = "node-row";
    
    const wasOpen = previouslyOpenAccordions.includes(node.id.toString());
    
    nodeRow.innerHTML = `
      <td colspan="5" class="px-0 py-0">
        <input type="checkbox" id="node-${node.id}" class="accordion-toggle hidden" ${wasOpen ? 'checked' : ''}>
        <label for="node-${node.id}" class="cursor-pointer flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <div class="flex items-center">
            <div class="flex-shrink-0 h-10 w-10 rounded-lg bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center">
              <i class="fas fa-sitemap text-primary-500"></i>
            </div>
            <div class="ml-4">
              <div class="text-sm font-medium text-gray-900 dark:text-white">${escapeHtml(node.name)}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">${node.devices.length} dispositivos</div>
            </div>
          </div>
          <div class="flex items-center">
            <div class="flex items-center space-x-2 mr-3">
              <button class="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm" 
                      onclick="editNode('${node.id}', '${escapeHtml(node.name).replace(/'/g, "\\'")}')"
                      title="Editar nodo">
                <i class="fas fa-edit"></i>
              </button>
              <button class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm" 
                      onclick="deleteNode(${node.id})"
                      title="Eliminar nodo">
                <i class="fas fa-trash"></i>
              </button>
            </div>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${nodeStatusClass} mr-3">
              <span class="status-dot ${nodeStatusDot}"></span>
              ${nodeStatusText}
            </span>
            <span class="accordion-arrow text-gray-400 transition-transform ${wasOpen ? 'rotate-180' : ''}">
              <i class="fas fa-chevron-down"></i>
            </span>
          </div>
        </label>
        <div class="accordion-content ${wasOpen ? '' : 'hidden'}" style="${wasOpen ? 'max-height: 1000px;' : 'max-height: 0px;'}">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <tbody>
              ${renderDevicesHTML(node.devices)}
            </tbody>
          </table>
        </div>
      </td>
    `;

    nodesTable.appendChild(nodeRow);
  });

  setTimeout(() => {
    setupAccordionEvents();
  }, 50);
  
  updateCounts(nodes.length, totalDevices);
  console.log(`Tabla renderizada: ${nodes.length} nodos, ${totalDevices} dispositivos totales`);
}

function renderNodesTablePreservingAccordions(nodes, previouslyOpenAccordions) {
  const nodesTable = document.getElementById("nodesTable");
  if (!nodesTable) {
    console.error("Elemento nodesTable no encontrado");
    return;
  }
  
  console.log("Renderizando tabla preservando acordeones:", previouslyOpenAccordions);
  
  if (nodesTable.children.length === 0 || !nodes || nodes.length === 0) {
    renderNodesTable(nodes);
    return;
  }
  
  let totalDevices = 0;
  let newHTML = '';
  
  nodes.forEach((node) => {
    totalDevices += node.devices.length;
    
    let nodeStatusClass, nodeStatusText, nodeStatusDot;
    switch (node.status) {
      case "online":
        nodeStatusClass = "text-green-800 dark:text-green-400 bg-green-100 dark:bg-green-900/30";
        nodeStatusText = "Operacional";
        nodeStatusDot = "online";
        break;
      case "offline":
        nodeStatusClass = "text-red-800 dark:text-red-400 bg-red-100 dark:bg-red-900/30";
        nodeStatusText = "Inactivo";
        nodeStatusDot = "offline";
        break;
      case "warning":
        nodeStatusClass = "text-yellow-800 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30";
        nodeStatusText = "Con problemas";
        nodeStatusDot = "warning";
        break;
      default:
        nodeStatusClass = "text-gray-800 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30";
        nodeStatusText = "Desconocido";
        nodeStatusDot = "offline";
        break;
    }
    
    const wasOpen = previouslyOpenAccordions.includes(node.id.toString());
    
    newHTML += `
      <tr class="node-row">
        <td colspan="5" class="px-0 py-0">
          <input type="checkbox" id="node-${node.id}" class="accordion-toggle hidden" ${wasOpen ? 'checked' : ''}>
          <label for="node-${node.id}" class="cursor-pointer flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <div class="flex items-center">
              <div class="flex-shrink-0 h-10 w-10 rounded-lg bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center">
                <i class="fas fa-sitemap text-primary-500"></i>
              </div>
              <div class="ml-4">
                <div class="text-sm font-medium text-gray-900 dark:text-white">${escapeHtml(node.name)}</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">${node.devices.length} dispositivos</div>
              </div>
            </div>
            <div class="flex items-center">
              <div class="flex items-center space-x-2 mr-3">
                <button class="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm" 
                        onclick="editNode('${node.id}', '${escapeHtml(node.name).replace(/'/g, "\\'")}')"
                        title="Editar nodo">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm" 
                        onclick="deleteNode(${node.id})"
                        title="Eliminar nodo">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${nodeStatusClass} mr-3">
                <span class="status-dot ${nodeStatusDot}"></span>
                ${nodeStatusText}
              </span>
              <span class="accordion-arrow text-gray-400 transition-transform ${wasOpen ? 'rotate-180' : ''}">
                <i class="fas fa-chevron-down"></i>
              </span>
            </div>
          </label>
          <div class="accordion-content ${wasOpen ? '' : 'hidden'}" style="${wasOpen ? 'max-height: 1000px;' : 'max-height: 0px;'}">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <tbody>
                ${renderDevicesHTML(node.devices)}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    `;
  });
  
  nodesTable.innerHTML = newHTML;
  
  setTimeout(() => {
    setupAccordionEvents();
  }, 50);
  
  updateCounts(nodes.length, totalDevices);
  console.log(`Tabla renderizada preservando acordeones: ${nodes.length} nodos, ${totalDevices} dispositivos totales`);
}

function updateCounts(nodesCount, devicesCount) {
  const showingCount = document.getElementById("showingCount");
  const deviceCount = document.getElementById("deviceCount");

  if (showingCount) showingCount.textContent = nodesCount;
  if (deviceCount) deviceCount.textContent = devicesCount;
}

function filterNodes() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  const searchText = searchInput.value.toLowerCase();

  if (!searchText) {
    renderNodesTable(nodesData);
    return;
  }

  const filteredNodes = nodesData
    .map((node) => {
      const filteredDevices = node.devices.filter(
        (device) =>
          (device.name && device.name.toLowerCase().includes(searchText)) ||
          (device.ip && device.ip.includes(searchText)) ||
          (device.description &&
            device.description.toLowerCase().includes(searchText))
      );

      return {
        ...node,
        devices: filteredDevices,
      };
    })
    .filter((node) => node.devices.length > 0);

  renderNodesTable(filteredNodes);
}

function toggleTheme() {
  const html = document.documentElement;
  const themeIcon = document.getElementById("themeIcon");

  if (!themeIcon) return;

  if (html.classList.contains("dark")) {
    html.classList.remove("dark");
    html.classList.add("light");
    themeIcon.classList.remove("fa-sun");
    themeIcon.classList.add("fa-moon");
    localStorage.setItem("theme", "light");
  } else {
    html.classList.remove("light");
    html.classList.add("dark");
    themeIcon.classList.remove("fa-moon");
    themeIcon.classList.add("fa-sun");
    localStorage.setItem("theme", "dark");
  }
}

function openAddNodeModal() {
    const modal = document.getElementById('addNodeModal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    currentModal = 'node';
    
    document.getElementById('nodeName').value = '';
    const errorElement = document.getElementById('nodeError');
    if (errorElement) {
        errorElement.classList.add('hidden');
        errorElement.textContent = '';
    }
    
    setTimeout(() => {
        const nameInput = document.getElementById('nodeName');
        if (nameInput) {
            nameInput.focus();
        }
    }, 100);
}

function closeAddNodeModal() {
    const modal = document.getElementById('addNodeModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentModal = null;
}

function addNewNode() {
    const nameInput = document.getElementById('nodeName');
    const errorElement = document.getElementById('nodeError');
    
    const nodeName = nameInput.value.trim();
    
    if (!nodeName) {
        if (errorElement) {
            errorElement.textContent = 'Por favor, ingresa un nombre para el nodo';
            errorElement.classList.remove('hidden');
            nameInput.focus();
        }
        return;
    }
    
    if (nodeName.length > 100) {
        if (errorElement) {
            errorElement.textContent = 'El nombre del nodo no puede exceder los 100 caracteres';
            errorElement.classList.remove('hidden');
            nameInput.focus();
        }
        return;
    }
    
    if (errorElement) {
        errorElement.classList.add('hidden');
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        showNotification('Agregando nodo...', 'info');
        
        ws.send(JSON.stringify({
            type: 'add_node',
            name: nodeName
        }));
        
        closeAddNodeModal();
    } else {
        if (errorElement) {
            errorElement.textContent = 'No hay conexión con el servidor. Intenta de nuevo.';
            errorElement.classList.remove('hidden');
        }
        showNotification('Error de conexión', 'error');
    }
}

function openAddDeviceModal() {
    const modal = document.getElementById('addDeviceModal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    currentModal = 'device';
    
    document.getElementById('deviceName').value = '';
    document.getElementById('deviceIp').value = '';
    document.getElementById('devicePort').value = '';
    document.getElementById('deviceDescription').value = '';
    const errorElement = document.getElementById('deviceError');
    if (errorElement) {
        errorElement.classList.add('hidden');
        errorElement.textContent = '';
    }
    
    loadNodesForSelect();
    
    setTimeout(() => {
        const nameInput = document.getElementById('deviceName');
        if (nameInput) {
            nameInput.focus();
        }
    }, 100);
}

function closeAddDeviceModal() {
    const modal = document.getElementById('addDeviceModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentModal = null;
}

function addNewDevice() {
    const name = document.getElementById('deviceName').value.trim();
    const ip = document.getElementById('deviceIp').value.trim();
    const port = document.getElementById('devicePort').value.trim();
    const nodeId = document.getElementById('deviceNode').value;
    const description = document.getElementById('deviceDescription').value.trim();
    const errorElement = document.getElementById('deviceError');
    
    let errors = [];
    
    if (!name) errors.push('El nombre del dispositivo es requerido');
    if (!ip) errors.push('La dirección IP es requerida');
    if (!port) errors.push('El puerto es requerido');
    if (!nodeId) errors.push('Debes seleccionar un nodo');
    
    if (ip && !isValidIP(ip)) {
        errors.push('La dirección IP no tiene un formato válido');
    }
    
    const portNum = parseInt(port);
    if (port && (isNaN(portNum) || portNum < 1 || portNum > 65535)) {
        errors.push('El puerto debe ser un número entre 1 y 65535');
    }
    
    if (errors.length > 0) {
        if (errorElement) {
            errorElement.textContent = errors.join(', ');
            errorElement.classList.remove('hidden');
        }
        return;
    }
    
    if (errorElement) {
        errorElement.classList.add('hidden');
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        showNotification('Agregando dispositivo...', 'info');
        
        ws.send(JSON.stringify({
            type: 'add_device',
            name: name,
            ip: ip,
            port: portNum,
            node_id: parseInt(nodeId),
            description: description || ''
        }));
        
        closeAddDeviceModal();
    } else {
        if (errorElement) {
            errorElement.textContent = 'No hay conexión con el servidor';
            errorElement.classList.remove('hidden');
        }
        showNotification('Error de conexión', 'error');
    }
}

function isValidIP(ip) {
    const ipv4Pattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
}

function updateNodesList(nodes) {
    nodesList = nodes || [];
    console.log(`Lista de nodos actualizada: ${nodesList.length} nodos disponibles`);
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

document.addEventListener("DOMContentLoaded", function () {
    console.log("Inicializando aplicación...");
    
    const savedTheme = localStorage.getItem("theme") || "light";
    if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
        const themeIcon = document.getElementById("themeIcon");
        if (themeIcon) themeIcon.classList.add("fa-sun");
    } else {
        document.documentElement.classList.add("light");
        const themeIcon = document.getElementById("themeIcon");
        if (themeIcon) themeIcon.classList.add("fa-moon");
    }

    setTimeout(() => {
        connectWebSocket();
    }, 1000);

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", filterNodes);
    }

    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", toggleTheme);
    }

    const forceCheckBtn = document.getElementById("forceCheckBtn");
    if (forceCheckBtn) {
        forceCheckBtn.addEventListener("click", forceCheck);
    }

    const addNodeBtn = document.getElementById("addNodeBtn");
    if (addNodeBtn) {
        addNodeBtn.addEventListener("click", openAddNodeModal);
    }

    const addDeviceBtn = document.getElementById("addDeviceBtn");
    if (addDeviceBtn) {
        addDeviceBtn.addEventListener("click", openAddDeviceModal);
    }

    setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
        }
    }, 30000);
    
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            if (currentModal === 'edit_node') {
                closeEditNodeModal();
            } else if (currentModal === 'edit_device') {
                closeEditDeviceModal();
            } else if (currentModal === 'node') {
                closeAddNodeModal();
            } else if (currentModal === 'device') {
                closeAddDeviceModal();
            }
        }
    });
    
    setTimeout(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            requestNodesList();
        }
    }, 2000);
});