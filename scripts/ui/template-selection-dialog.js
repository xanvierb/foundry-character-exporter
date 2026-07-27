import { TEMPLATE_DIALOG_PATH } from "../constants.js";
import { getDialogV2, localize, renderFoundryTemplate } from "../foundry/compatibility.js";

function translatedTemplate(template) {
  return {
    ...template,
    name: localize(template.name, template.name),
    description: localize(template.description, template.description)
  };
}

export class TemplateSelectionDialog {
  async choose(templates, actorName) {
    if (!templates.length) return null;
    const contentHtml = await renderFoundryTemplate(TEMPLATE_DIALOG_PATH, {
      actorName,
      templates: templates.map(translatedTemplate)
    });
    const content = globalThis.document.createElement("div");
    content.innerHTML = contentHtml;
    const DialogV2 = getDialogV2();

    return DialogV2.wait({
      window: {
        title: localize("CHARACTER-EXPORTER.Dialog.Title", "Export Character")
      },
      classes: ["character-exporter-template-dialog"],
      content,
      modal: true,
      rejectClose: false,
      buttons: [
        {
          action: "cancel",
          label: localize("CHARACTER-EXPORTER.Dialog.Cancel", "Cancel"),
          callback: () => null
        },
        {
          action: "export",
          label: localize("CHARACTER-EXPORTER.Dialog.Export", "Open Print View"),
          icon: "fas fa-file-export",
          default: true,
          callback: (_event, button) => {
            const templateId = button.form?.elements?.templateId?.value;
            if (!templateId) return null;
            const windowName = `character-exporter-${Date.now()}`;
            const printWindow = globalThis.window.open("", windowName, "popup=yes,width=1100,height=900");
            return { templateId, printWindow };
          }
        }
      ]
    });
  }
}
