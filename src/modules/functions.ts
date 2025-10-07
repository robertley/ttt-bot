function getDeleteMeButton() {
  return {
    type: 2,
    style: 4,
    label: 'Delete Me',
    custom_id: 'delete-me',
  }
}

function getConfirmButton(id: 'reset-server') {
  return {
    type: 2,
    style: 3,
    label: 'Confirm',
    custom_id: `confirm-${id}`,
  }
}

export { getDeleteMeButton, getConfirmButton };